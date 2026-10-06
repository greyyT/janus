import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { TelegramBridge, TelegramButton } from "./telegram-bridge.ts";

type Question = {
  id: string;
  label: string;
  prompt: string;
  options: { value: string; label: string; description?: string }[];
  allowOther: boolean;
};
type Answer = {
  id: string;
  value: string;
  label: string;
  wasCustom: boolean;
  index?: number;
};
export type QuestionnaireState = {
  toolCallId: string;
  sessionId: string;
  questions: Question[];
  answers: Answer[];
  status: "open" | "submitted" | "cancelled";
};
type Action = { toolCallId: string; questionId?: string; index?: number; submit?: boolean };
type Card = { id: number; body: string; options: { index: number }[]; questionId?: string; rendered: string };
type Request = { state: QuestionnaireState; cards: Card[]; queue: Promise<void>; initialized: boolean };

function preview(text: string, length = 160): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= length) return compact;
  let end = length - 1;
  if (/^[\uDC00-\uDFFF]$/.test(compact[end])) end--;
  return `${compact.slice(0, end)}…`;
}

function parts(text: string, max = 3400): string[] {
  const result: string[] = [];
  while (text.length > max) {
    let end = max;
    if (/^[\uDC00-\uDFFF]$/.test(text[end])) end--;
    const newline = text.lastIndexOf("\n", end);
    if (newline > max / 2) end = newline + 1;
    result.push(text.slice(0, end));
    text = text.slice(end);
  }
  if (text) result.push(text);
  return result;
}

/** Phone presentation only; the ask tool owns all answers and completion. */
export class TelegramQuestionnaire {
  private readonly requests = new Map<string, Request>();
  private closed = false;

  constructor(
    private readonly pi: ExtensionAPI,
    private readonly bridge: TelegramBridge,
    private readonly sessionId: string,
    private readonly label: string,
    private readonly warn: (message: string) => void,
  ) { }

  update(state: QuestionnaireState): void {
    if (this.closed || state.sessionId !== this.sessionId) return;
    let request = this.requests.get(state.toolCallId);
    if (!request) {
      if (state.status !== "open") return;
      request = { state, cards: [], queue: Promise.resolve(), initialized: false };
      this.requests.set(state.toolCallId, request);
    }
    request.state = state;
    const current = request;
    current.queue = current.queue.then(async () => {
      if (this.closed) return;
      if (!current.initialized) {
        // Do not recreate partially delivered questionnaires after a transport failure.
        current.initialized = true;
        await this.open(current);
      }
      if (!this.closed) await this.render(current);
    }).catch((error) => {
      if (!this.closed) this.warn(String(error));
    });
  }

  async answer(encoded: string, text?: string): Promise<void> {
    const action = JSON.parse(encoded) as Action;
    const request = this.requests.get(action.toolCallId);
    if (this.closed || !request || request.state.status !== "open") {
      throw new Error("This questionnaire is closed. Answer the current questions instead.");
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The question is no longer available in Pi.")), 2000);
      this.pi.events.emit("questionnaire:command", {
        ...action,
        ...(text !== undefined ? { text } : {}),
        respond: (error?: string) => {
          clearTimeout(timer);
          if (error) reject(new Error(error));
          else resolve();
        },
      });
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.all([...this.requests.values()].map(async (request) => {
      await request.queue;
      for (const card of request.cards) {
        const state = request.state.status === "open" ? { ...request.state, status: "cancelled" as const } : request.state;
        const { text } = this.presentation(state, card);
        try {
          await this.bridge.editInteractive(card.id, text, []);
        } catch (error) {
          this.warn(`Could not close a Telegram question: ${String(error)}`);
        }
      }
    }));
    this.requests.clear();
  }

  private action(state: QuestionnaireState, fields: Omit<Action, "toolCallId">): string {
    return JSON.stringify({ toolCallId: state.toolCallId, ...fields });
  }

  private async open(request: Request): Promise<void> {
    const { state } = request;
    for (const [questionIndex, question] of state.questions.entries()) {
      const header = `❓ ${preview(this.label, 80)} · Question ${questionIndex + 1}/${state.questions.length}\n${question.label}\n\n${question.prompt}`;
      const instruction = question.allowOther
        ? "Tap a number below, or reply to this question with your own answer."
        : "Tap a number below to choose an option.";
      const pageCount = Math.max(1, Math.ceil(question.options.length / 80));
      for (let page = 0; page < pageCount; page++) {
        const pageOptions = question.options.slice(page * 80, (page + 1) * 80);
        const options = pageOptions.map((_option, index) => ({ index: page * 80 + index + 1 }));
        const body = [
          header,
          ...(pageCount > 1 ? [`Options · page ${page + 1}/${pageCount}`] : []),
          pageOptions.map((option, index) => `${page * 80 + index + 1}. ${option.label}${option.description ? `\n   ${option.description}` : ""}`).join("\n\n"),
          instruction,
        ].filter(Boolean).join("\n\n");
        const chunks = parts(body);
        for (const [i, chunk] of chunks.entries()) {
          if (this.closed) return;
          const card: Card = {
            id: 0, body: chunk, questionId: question.id,
            options: i === chunks.length - 1 ? options : [], rendered: "",
          };
          const { text, buttons } = this.presentation(request.state, card);
          card.id = await this.bridge.sendInteractive(text, {
            buttons,
            replyAction: this.action(state, { questionId: question.id }),
          });
          card.rendered = JSON.stringify({ text, buttons });
          request.cards.push(card);
        }
      }
    }
    if (state.questions.length > 1 && !this.closed) {
      const card: Card = { id: 0, body: "", options: [], rendered: "" };
      const { text, buttons } = this.presentation(request.state, card);
      card.id = await this.bridge.sendInteractive(text, { buttons });
      card.rendered = JSON.stringify({ text, buttons });
      request.cards.push(card);
    }
  }

  private presentation(state: QuestionnaireState, card: Card): { text: string; buttons: TelegramButton[][] } {
    const open = state.status === "open";
    if (card.questionId !== undefined) {
      const answer = state.answers.find((item) => item.id === card.questionId);
      const status = state.status === "cancelled" ? "Cancelled — this question is closed."
        : answer ? `✓ ${answer.wasCustom ? "Your answer" : `Selected ${answer.index}`}: ${preview(answer.label)}${open ? "\nYou can change this before submitting." : "\nSubmitted — the agent can continue."}`
          : open ? "Waiting for your answer." : "This question is closed.";
      const buttons = open ? card.options.map((option) => ({
        text: `${answer?.index === option.index && !answer.wasCustom ? "✓ " : ""}${option.index}`,
        action: this.action(state, { questionId: card.questionId, index: option.index }),
      })) : [];
      const rows: TelegramButton[][] = [];
      for (let i = 0; i < buttons.length; i += 4) rows.push(buttons.slice(i, i + 4));
      return { text: `${card.body}\n\n${status}`, buttons: rows };
    }
    const answered = state.questions.filter((question) => state.answers.some((answer) => answer.id === question.id)).length;
    const ready = answered === state.questions.length;
    const heading = state.status === "submitted" ? "✓ Answers submitted" : state.status === "cancelled" ? "Questionnaire cancelled" : ready ? "Answers ready to submit" : "Answer progress";
    // Keep the phone summary within one message; full question/answer details stay on their cards.
    const summaries = state.questions.slice(0, 20).map((question) => {
      const answer = state.answers.find((item) => item.id === question.id);
      return `${preview(question.label, 40)}: ${answer ? `${answer.wasCustom ? "Custom" : answer.index} · ${preview(answer.label, 100)}` : "not answered"}`;
    });
    if (state.questions.length > 20) summaries.push(`… ${state.questions.length - 20} more questions; see their messages above.`);
    return {
      text: [`${heading} · ${answered}/${state.questions.length}\n${preview(this.label, 80)}`, summaries.join("\n\n"),
      open ? ready ? "Review your answers above, then submit to let the agent continue." : "Answer each question above. You can answer in any order." : "These buttons are no longer active.",
      ].join("\n\n"),
      buttons: open && ready ? [[{ text: "Submit answers", action: this.action(state, { submit: true }) }]] : [],
    };
  }

  private async render(request: Request): Promise<void> {
    for (const card of request.cards) {
      if (this.closed) return;
      const { text, buttons } = this.presentation(request.state, card);
      const rendered = JSON.stringify({ text, buttons });
      if (rendered === card.rendered) continue;
      await this.bridge.editInteractive(card.id, text, buttons);
      card.rendered = rendered;
    }
  }
}
