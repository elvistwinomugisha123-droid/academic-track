import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { restoreAuthState } from "./auth-state";
import { observeBrowserFailures } from "./browser-failures";

type AssessmentFixture = {
  fixtureSuffix: string;
  teacherEmail: string;
  teacherPassword: string;
  dosEmail: string;
  schoolSubjectId: string;
  subjectProfileId: string;
  assessmentProfileId: string;
  periodId: string;
  sectionAId: string;
  assessmentDate: string;
  canonicalIds: string[];
};

const fixturePath = "test-artifacts/assessment-fixture.json";
const fixture: AssessmentFixture | null = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, "utf8")) as AssessmentFixture
  : null;

function requireFixture() {
  if (!fixture) throw new Error("BLOCKED: assessment fixture is unavailable. Run scripts/assessment-test-fixture.ts against the isolated TEST Supabase project.");
  return fixture;
}

const browserFailures = (page: Page) => observeBrowserFailures(page, {
  expectedRequestFailure: (request, errorText) => errorText === "net::ERR_ABORTED" && (request.url().includes("_rsc=") || (request.method() === "POST" && request.url().includes("/workspace/teacher/assessments"))),
});

async function signIn(page: Page, role: "teacher" | "dos" = "teacher", next = role === "teacher" ? "/workspace/teacher/assessments" : "/workspace/leadership/dos") {
  await restoreAuthState(page, "assessment", role, next);
}

test.describe("Assessment Studio walkthrough", () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    page.setDefaultTimeout(60_000);
  });

  test("teacher authors, submits, receives review return, then exports after approval", async ({ page }) => {
    const data = requireFixture();
    const assessmentTitle = `Synthetic microscope class test ${data.fixtureSuffix}-${Date.now()}`;
    const assertClean = browserFailures(page);
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Assessment Studio" })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("combobox", { name: "Purpose", exact: true }).selectOption("CLASS_TEST");
    await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption(data.schoolSubjectId);
    await page.getByRole("combobox", { name: "Academic period", exact: true }).selectOption(data.periodId);
    await page.getByRole("textbox", { name: "Assessment date", exact: true }).fill(data.assessmentDate);
    await page.getByRole("textbox", { name: "Curriculum subject profile", exact: true }).fill(data.subjectProfileId);
    await page.getByRole("combobox", { name: "Assessment profile", exact: true }).selectOption(data.assessmentProfileId);
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(assessmentTitle);
    await page.getByRole("spinbutton", { name: "Duration (minutes)", exact: true }).fill("40");
    await page.getByRole("spinbutton", { name: "Total marks", exact: true }).fill("20");
    await page.getByRole("checkbox", { name: new RegExp(data.sectionAId) }).check();
    await page.getByRole("button", { name: "Open assessment workspace" }).click();

    await expect(page.getByRole("heading", { name: assessmentTitle, exact: true }).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByLabel("Question text").fill("Describe one observation a learner can make when viewing a prepared specimen through a microscope.");
    await page.getByLabel("Marks").fill("20");
    await page.getByLabel("Eligible curriculum IDs").fill(data.canonicalIds[0]);
    await page.getByLabel("Marking guide").fill("Award 20 marks for a clear, scientifically accurate observation linked to the prepared specimen.");
    await page.getByRole("button", { name: "Save version" }).click();
    await expect(page.getByRole("status")).toContainText("Saved as a new teacher version.", { timeout: 60_000 });

    await page.reload();
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeEnabled();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByRole("status")).toContainText("Assessment submitted for academic review. Editing is now frozen.", { timeout: 60_000 });
    const workspaceUrl = page.url();

    await page.context().clearCookies();
    await signIn(page, "dos");
    await expect(page.getByRole("heading", { name: /Academic Operations/i })).toBeVisible({ timeout: 60_000 });
    const reviewRow = page.locator(".assessment-review-row").filter({ hasText: assessmentTitle });
    await expect(reviewRow).toBeVisible({ timeout: 60_000 });
    await reviewRow.getByRole("link", { name: "Open review" }).click();
    await expect(page).toHaveURL(/\/workspace\/leadership\/assessments\/[0-9a-f-]+$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: assessmentTitle, exact: true }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Read-only submitted assessment content for authorised academic review.")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept("Clarify the marking evidence before approval."));
    await page.getByRole("button", { name: "Return to draft" }).click();
    await expect(page).toHaveURL(/\/workspace\/leadership\/dos$/, { timeout: 60_000 });

    await page.context().clearCookies();
    await signIn(page, "teacher", "/workspace/teacher/assessments");
    await page.goto(workspaceUrl);
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeEnabled({ timeout: 60_000 });
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByRole("status")).toContainText("Assessment submitted for academic review", { timeout: 60_000 });

    await page.context().clearCookies();
    await signIn(page, "dos");
    const resubmittedRow = page.locator(".assessment-review-row").filter({ hasText: assessmentTitle });
    await expect(resubmittedRow).toBeVisible({ timeout: 60_000 });
    await resubmittedRow.getByRole("link", { name: "Open review" }).click();
    await expect(page).toHaveURL(/\/workspace\/leadership\/assessments\/[0-9a-f-]+$/, { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Approve and finalise" })).toBeEnabled({ timeout: 60_000 });
    await page.getByRole("button", { name: "Approve and finalise" }).click();
    await expect(page).toHaveURL(/\/workspace\/leadership\/dos$/, { timeout: 60_000 });

    await page.context().clearCookies();
    await signIn(page, "teacher", "/workspace/teacher/assessments");
    await page.goto(workspaceUrl);
    await expect(page.getByRole("link", { name: "Question Paper PDF" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Marking Guide PDF" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Question Paper DOCX" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Marking Guide DOCX" })).toBeVisible();

    for (const linkName of ["Question Paper PDF", "Marking Guide PDF", "Question Paper DOCX", "Marking Guide DOCX"]) {
      const href = await page.getByRole("link", { name: linkName }).getAttribute("href");
      expect(href).toBeTruthy();
      const response = await page.request.get(href!);
      expect(response.status(), `${linkName} status`).toBe(200);
      const isDocx = linkName.endsWith("DOCX");
      expect(response.headers()["content-type"], `${linkName} content type`).toContain(isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf");
      expect((await response.body()).byteLength, `${linkName} body`).toBeGreaterThan(isDocx ? 1_000 : 100);
    }

    assertClean();
  });
});
