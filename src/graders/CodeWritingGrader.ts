import { AssignedQuestion, GradedQuestion } from "../exams";
import { BLANK_SUBMISSION, ResponseKind } from "../response/common";
import { QuestionGrader, GradingResult } from "../QuestionGrader";
import { ExamUtils } from "../ExamUtils";
import { CodeWritingGradingAssignment } from "../grading/code-grader";
import { renderGradingProgressBar, renderNumBadge, renderShortPointsWorthBadge, renderWideNumBadge } from "../ui_components";
import { sum } from "simple-statistics";
import { applySkin, highlightCode, mk2html } from "../render";
import { asMutable, assert, assertFalse } from "../util";
import { createFilledFITB, FITBSubmission } from "../response/fitb";
import { QuestionSpecification } from "../specification";

export type CodeWritingRubricItemStatus = "on" | "off" | "unknown";
// type ManualOverrideRubricItemStatus = "on" | "off";

export type CodeWritingRubricItem = {
  id: string,
  points: number,
  title: string,
  description: string
};

export type CodeWritingRubricItemGradingResult = {
  status: CodeWritingRubricItemStatus,
  // manual_override_status?: ManualOverrideRubricItemStatus,
  // verified: boolean
};

export type CodeWritingGradingResult = GradingResult & {
  /** Maps rubric item ID to result*/
  itemResults: {
    [index: string]: CodeWritingRubricItemGradingResult | undefined
  },
  verified: boolean
};





export class CodeWritingGrader implements QuestionGrader<ResponseKind> {

  public readonly rubric: readonly CodeWritingRubricItem[];
  private manualGrading?: readonly CodeWritingGradingAssignment[];
  private manualGradingMap?: {[index: string]: CodeWritingGradingResult | undefined};

  public constructor(rubric: readonly CodeWritingRubricItem[]) {
    this.rubric = rubric;
  }

  public isGrader<T extends ResponseKind>(responseKind: T): this is QuestionGrader<T> {
    return true;
  }

  public prepare(exam_id: string, question_id: string) {

    this.manualGrading = <CodeWritingGradingAssignment[]>ExamUtils.readGradingAssignments(exam_id, question_id); 

    this.manualGradingMap = {};
    this.manualGrading.forEach(
      assn => assn.groups.forEach(
        group => group.submissions.forEach(
          sub => this.manualGradingMap![sub.question_uuid] = group.grading_result
        )
      )
    );
  }
  
  // public prepareManualGrading(aqs: readonly AssignedQuestion[]) {
  //   if (aqs.length === 0) {
  //     return;
  //   }
  //   let assns = this.createGradingAssignments(aqs);
  //   this.writeGradingAssignments(aqs[0].exam.exam_id, aqs[0].question.question_id, assns);
  // }

  public grade(aq: AssignedQuestion) : CodeWritingGradingResult | undefined {
    assert(this.manualGradingMap, "Grader prepare() function must be called before attempting grading.");
    let submission = aq.submission;
    if (submission === BLANK_SUBMISSION || submission === "") {
      return {
        wasBlankSubmission: true,
        itemResults: {},
        verified: true
      };
    }

    return this.manualGradingMap[aq.uuid];
  }

  public pointsEarned(gr: CodeWritingGradingResult) {
    return Object.values(this.rubric).reduce((p, ri) => p + (gr.itemResults[ri.id]?.status === "on" ? ri.points : 0), 0);
  }

  public renderReport(aq: GradedQuestion<ResponseKind, CodeWritingGradingResult>) {
    let gr = aq.gradingResult;

    if (aq.submission === BLANK_SUBMISSION || gr.wasBlankSubmission) {
      return "Your answer for this question was blank.";
    }

    let skin = aq.skin;
    let question = aq.question;
    let studentSubmission = "";
    let res = aq.gradingResult;
    if (question.isKind("code_editor")) {
      let response = question.response;
      studentSubmission = `
        <div class="examma-ray-code-editor-header">
          ${response.header ? `<pre><code>${highlightCode(applySkin(response.header, skin), response.code_language)}</code></pre>` : ""}
        </div>
        <div class="examma-ray-code-editor-graded-submission">
          ${`<pre><code>${highlightCode(""+aq.submission, "cpp")}</code></pre>`}
        </div>
        <div class="examma-ray-code-editor-footer">
          ${response.footer ? `<pre><code>${highlightCode(applySkin(response.footer, skin), response.code_language)}</code></pre>` : ""}
        </div>
      `
    }
    else if (question.isKind("fitb")) {
      let content = question.response.content;
      let submission = <FITBSubmission>aq.submission;
      assert(submission !== BLANK_SUBMISSION);

      studentSubmission = createFilledFITB(applySkin(content, skin), submission.map(s => s)); //, content, scores);
      
    }
    else {
      return assertFalse();
    }

    
    return `
      <table>
        <tr style="text-align: center;">
          <th>Rubric</th>
          <th>Your Submission</th>
        </tr>
        <tr>
          <td>
            <ul class="list-group examma-ray-manual-graded-rubric">
              ${this.rubric.map(ri => {
                let itemResult = res.itemResults[ri.id];
                let statusClass = "";
                if (itemResult?.status === "on") {
                  if (ri.points > 0) {
                    statusClass = "list-group-item-success"
                  }
                  else if (ri.points === 0) {
                    statusClass = "list-group-item-secondary"
                  }
                  else {
                    statusClass = "list-group-item-danger"
                  }
                }
                return `
                <li class="list-group-item examma-ray-manual-graded-rubric-item ${statusClass}">
                  ${renderShortPointsWorthBadge(ri.points)}
                  <b>${mk2html(ri.title, skin)}</b>
                  ${mk2html(ri.description, skin)}
                </li>
              `}).join("")}
            </ul>
          </td>
          <td style="padding: 1em;">
            ${studentSubmission}
          </td>
        </tr>
      </table>
    `;
  }

  
  public renderStats() {
    return "Stats are not implemented for this question/grader type yet.";
  }

  public renderOverview() {
    assert(this.manualGrading, "Grader prepare() function must be called before attempting grading.");
    return `
      ${this.manualGrading.map(assn => {
        let name = assn.name ?? "unnamed_grading_assignemnt";
        let numGroups = assn.groups.length;
        let numSubmissions = sum(assn.groups.map(g => g.submissions.length));
        let numGraded = sum(assn.groups.filter(g => g.grading_result).map(g => g.submissions.length));
        return `<div>${renderGradingProgressBar(numGraded, numSubmissions)} ${renderWideNumBadge(`${numGroups} groups`)} ${name}</div>`;
      }).join("")}
    `;
  }




}