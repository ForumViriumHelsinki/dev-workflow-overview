import { describe, it, expect, beforeAll } from "vitest";
import "./workflow-stage.js";
import type { WorkflowStage } from "./workflow-stage.js";

async function mount(status?: string): Promise<WorkflowStage> {
  const el = document.createElement("workflow-stage") as WorkflowStage;
  el.number = 1;
  el.stageTitle = "Test";
  el.color = "#fff";
  el.cards = [];
  if (status !== undefined) (el as unknown as { status: string }).status = status;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe("<workflow-stage>", () => {
  beforeAll(() => {
    // Ensure the element has loaded before each test.
  });

  it("renders no status dot when status is undefined (static mode)", async () => {
    const el = await mount(undefined);
    const dot = el.shadowRoot!.querySelector(".status-dot");
    expect(dot).toBeNull();
  });

  it("renders a dot with aria-label when status is 'ok'", async () => {
    const el = await mount("ok");
    const dot = el.shadowRoot!.querySelector(".status-dot");
    expect(dot).not.toBeNull();
    expect(dot!.getAttribute("aria-label")).toBe("Healthy");
    expect(dot!.getAttribute("data-state")).toBe("ok");
  });

  it("hides the dot for 'n/a' (stage does not apply)", async () => {
    const el = await mount("n/a");
    const dot = el.shadowRoot!.querySelector(".status-dot");
    expect(dot).toBeNull();
  });

  it("switches dot state on reactive property update", async () => {
    const el = await mount("ok");
    (el as unknown as { status: string }).status = "fail";
    await el.updateComplete;
    const dot = el.shadowRoot!.querySelector(".status-dot");
    expect(dot!.getAttribute("data-state")).toBe("fail");
  });
});
