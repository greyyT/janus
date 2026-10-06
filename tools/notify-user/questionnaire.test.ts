import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, expect, test, vi } from "vitest";
import { TelegramQuestionnaire, type QuestionnaireState } from "../../.pi/extensions/lib/telegram-questionnaire.js";
import type { TelegramBridge, TelegramButton } from "../../.pi/extensions/lib/telegram-bridge.js";

type Bus = { emit(channel: string, data: unknown): void; on(channel: string, handler: (data: unknown) => void): () => void };
type Component = { render(width: number): string[]; handleInput(data: string): void; dispose(): void };
type Result = { details: { answers: { id: string; value: string; index?: number; wasCustom: boolean }[]; cancelled: boolean } };
type Tool = { execute(id: string, params: object, signal: AbortSignal, update: undefined, ctx: object): Promise<Result> };
type Loaded = { extensions: { tools: Map<string, { definition: Tool }>; handlers: Map<string, ((event: object, ctx: object) => void)[]> }[]; errors: object[] };
let loadExtensions: (paths: string[], cwd: string, bus: Bus) => Promise<Loaded>;
let createEventBus: () => Bus;

beforeAll(async () => {
  const cli = pathToFileURL(realpathSync(execFileSync("which", ["pi"], { encoding: "utf8" }).trim()));
  ({ loadExtensions } = await import(new URL("../core/extensions/loader.js", cli).href));
  ({ createEventBus } = await import(new URL("../core/event-bus.js", cli).href));
});

const questions = [
  {
    id: "storage", label: "Storage", prompt: "Which database?", options: [
      { value: "sqlite", label: "SQLite", description: "Simple <local> storage & fewer services" },
      { value: "postgres", label: "PostgreSQL" },
    ]
  },
  { id: "deploy", label: "Deployment", prompt: "Where should it run?", options: [{ value: "local", label: "Locally" }], allowOther: true },
];

async function harness(params: object = { questions }) {
  const bus = createEventBus();
  const loaded = await loadExtensions([join(homedir(), ".pi/agent/extensions/questionnaire.ts")], process.cwd(), bus);
  expect(loaded.errors).toEqual([]);
  const extension = loaded.extensions[0];
  const cards = new Map<number, { text: string; buttons: TelegramButton[][]; replyAction?: string }>();
  let nextId = 0;
  const bridge: TelegramBridge = {
    send: vi.fn(), close: vi.fn(),
    async sendInteractive(text, options) { const id = ++nextId; cards.set(id, { text, ...options }); return id; },
    editInteractive: vi.fn(async (id, text, buttons) => { cards.set(id, { ...cards.get(id), text, buttons }); }),
  };
  const warnings = vi.fn();
  const presentation = new TelegramQuestionnaire({ events: bus } as ConstructorParameters<typeof TelegramQuestionnaire>[0], bridge, "session", "Janus", warnings);
  const states: QuestionnaireState[] = [];
  bus.on("questionnaire:state", (data) => { states.push(data as QuestionnaireState); presentation.update(data as QuestionnaireState); });
  let component: Component;
  const theme = { fg: (_color: string, text: string) => text, bg: (_color: string, text: string) => text, bold: (text: string) => text };
  const ctx = {
    mode: "tui", sessionManager: { getSessionId: () => "session" },
    ui: {
      custom: (factory: (tui: object, theme: object, keys: object, done: (result: object) => void) => Component) => new Promise((resolve) => {
        component = factory({ requestRender: vi.fn() }, theme, {}, resolve);
      }).then((result) => { component.dispose(); return result; })
    },
  };
  const abort = new AbortController();
  const result = extension.tools.get("ask")!.definition.execute("ask-1", params, abort.signal, undefined, ctx);
  return { bus, cards, bridge, presentation, states, warnings, abort, result, component: () => component!, extension, ctx };
}

function cardFor(cards: Map<number, { text: string; replyAction?: string; buttons: TelegramButton[][] }>, id: string) {
  return [...cards.values()].find((card) => card.replyAction && JSON.parse(card.replyAction).questionId === id)!;
}

test("remote answers share the real ask state, support edits and out-of-order questions, and require Submit", async () => {
  const h = await harness();
  await vi.waitFor(() => expect(h.cards.size).toBe(3));
  const storage = cardFor(h.cards, "storage");
  const deploy = cardFor(h.cards, "deploy");
  expect(storage.text).toContain("1. SQLite\n   Simple <local> storage & fewer services");
  expect(storage.buttons[0].map((button) => button.text)).toEqual(["1", "2"]);
  await expect(h.presentation.answer(JSON.stringify({ toolCallId: "ask-1", submit: true }))).rejects.toThrow("Answer every question");
  await h.presentation.answer(deploy.replyAction!, "my existing VPS");
  await h.presentation.answer(storage.buttons[0][1].action);
  expect(h.states.at(-1)?.status).toBe("open");
  await vi.waitFor(() => expect(cardFor(h.cards, "storage").buttons[0][1].text).toBe("✓ 2"));
  expect(h.component().render(80).join("\n")).toContain("■ Storage");
  await h.presentation.answer(storage.buttons[0][0].action);
  await vi.waitFor(() => expect([...h.cards.values()].find((card) => !card.replyAction)?.text).toContain("SQLite"));
  const submit = [...h.cards.values()].find((card) => !card.replyAction)!.buttons[0][0];
  await h.presentation.answer(submit.action);
  expect((await h.result).details).toEqual(expect.objectContaining({
    cancelled: false,
    answers: [
      expect.objectContaining({ id: "storage", value: "sqlite", index: 1, wasCustom: false }),
      expect.objectContaining({ id: "deploy", value: "my existing VPS", wasCustom: true }),
    ],
  }));
  await expect(h.presentation.answer(submit.action)).rejects.toThrow("closed");
  await expect(h.presentation.answer(deploy.replyAction!, "stale reply")).rejects.toThrow("closed");
  await vi.waitFor(() => expect([...h.cards.values()].every((card) => card.buttons.length === 0)).toBe(true));
  expect(h.warnings).not.toHaveBeenCalled();
});

test("terminal and Telegram answers complete the same ask result", async () => {
  const h = await harness();
  await vi.waitFor(() => expect(h.cards.size).toBe(3));
  h.component().handleInput("\r");
  await h.presentation.answer(cardFor(h.cards, "deploy").replyAction!, "server");
  h.component().handleInput("\t");
  h.component().handleInput("\r");
  expect((await h.result).details.answers.map((answer) => answer.value)).toEqual(["sqlite", "server"]);
  await vi.waitFor(() => expect([...h.cards.values()].every((card) => card.buttons.length === 0)).toBe(true));
});

test("one question submits immediately and text replies remain custom, even when numeric", async () => {
  const h = await harness({ questions: [questions[0]] });
  await vi.waitFor(() => expect(h.cards.size).toBe(1));
  await h.presentation.answer(cardFor(h.cards, "storage").replyAction!, "2");
  expect((await h.result).details.answers[0]).toMatchObject({ value: "2", wasCustom: true });
  await vi.waitFor(() => expect([...h.cards.values()][0].buttons).toEqual([]));
});

test("disallowed custom answers, empty replies and invalid choices do not answer a question", async () => {
  const h = await harness({ questions: [{ ...questions[0], allowOther: false }] });
  await vi.waitFor(() => expect(h.cards.size).toBe(1));
  const card = cardFor(h.cards, "storage");
  expect(card.text).not.toContain("reply to this question");
  await expect(h.presentation.answer(card.replyAction!, "custom")).rejects.toThrow("numbered options");
  await expect(h.presentation.answer(JSON.stringify({ toolCallId: "ask-1", questionId: "storage", index: 99 }))).rejects.toThrow("unavailable");
  await h.presentation.answer(card.buttons[0][1].action);
  expect((await h.result).details.answers[0]).toMatchObject({ value: "postgres", index: 2, wasCustom: false });
  const custom = await harness({ questions: [questions[0]] });
  await vi.waitFor(() => expect(custom.cards.size).toBe(1));
  await expect(custom.presentation.answer(cardFor(custom.cards, "storage").replyAction!, "  ")).rejects.toThrow("non-empty");
  custom.abort.abort();
  await custom.result;
});

test.each(["abort", "escape", "dispose", "session_shutdown", "session_start"])("%s closes questions and rejects late remote answers", async (method) => {
  const h = await harness();
  await vi.waitFor(() => expect(h.cards.size).toBe(3));
  const action = cardFor(h.cards, "storage").buttons[0][0].action;
  if (method === "abort") h.abort.abort();
  else if (method === "escape") h.component().handleInput("\x1b");
  else if (method === "dispose") h.component().dispose();
  else for (const handler of [...(h.extension.handlers.get(method) ?? [])]) handler({}, h.ctx);
  if (method !== "dispose") expect((await h.result).details.cancelled).toBe(true);
  await expect(h.presentation.answer(action)).rejects.toThrow("closed");
  await vi.waitFor(() => expect([...h.cards.values()].every((card) => card.buttons.length === 0)).toBe(true));
});

test("long prompts and many options split into reply-addressable messages without losing choices", async () => {
  const options = Array.from({ length: 90 }, (_, index) => ({
    value: String(index), label: index === 89 ? "😀".repeat(200) : `Option ${index + 1}`, description: "😀 <>& ".repeat(80),
  }));
  const h = await harness({ questions: [{ ...questions[0], prompt: "Long prompt\n".repeat(500), options }] });
  await vi.waitFor(() => expect([...h.cards.values()].flatMap((card) => card.buttons.flat()).length).toBe(90));
  const messages = [...h.cards.values()];
  expect(messages.every((card) => card.text.length <= 4096 && !!card.replyAction)).toBe(true);
  expect(messages.flatMap((card) => card.buttons).every((row) => row.length <= 4)).toBe(true);
  const button = messages.flatMap((card) => card.buttons.flat()).find((button) => button.text === "90")!;
  await h.presentation.answer(button.action);
  expect((await h.result).details.answers[0]).toMatchObject({ value: "89", index: 90 });
  await vi.waitFor(() => expect([...h.cards.values()].every((card) => card.buttons.length === 0)).toBe(true));
  expect([...h.cards.values()].every((card) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(card.text))).toBe(true);
});
