import { createReadStream, writeFileSync, readFileSync, mkdir, writeFile } from 'fs';
import { encode, decode } from "he";
import $ from 'jquery';
import 'colors';
import {average, max, mean, min, standardDeviation, sum} from 'simple-statistics'
import minimist from 'minimist';
import { RandomSeed, create as createRNG } from 'random-seed';
import { CLIPBOARD, FILE_CHECK, FILE_DOWNLOAD, FILE_UPLOAD } from './icons';
import { asMutable, assert, assertFalse, Mutable } from './util';
import { parse_submission, QuestionResponse, render_response, SubmissionType } from './response/responses';
import { FITBSubmission } from './response/fitb';
import { ResponseKind, BLANK_SUBMISSION } from './response/common';
import { MCSubmission } from './response/multiple_choice';
import { SASSubmission } from './response/select_a_statement';
import { mk2html } from '../render';
import { ExamAnswers, renderPointsWorthBadge, renderScoreBadge, renderUngradedBadge } from './common';
import { Exception, GraderMap, ExceptionMap } from './grader';
import { Grader, isGrader } from './graders/common';


export enum RenderMode {
  ORIGINAL = "ORIGINAL",
  GRADED = "GRADED",
}









export type QuestionSpecification<QT extends ResponseKind = ResponseKind> = {
  id: string,
  points: number,
  mk_description: string,
  response: QuestionResponse<QT>,
  tags?: readonly string[]
};

export class Question<QT extends ResponseKind = ResponseKind> {

  // public readonly raw_description: string;
  // public readonly description: string;
  // public readonly section: Section;
  public readonly spec: QuestionSpecification<QT>;
  public readonly id: string;
  public readonly tags: readonly string[];
  public readonly pointsPossible : number;
  public readonly html_description: string;
  public readonly kind: QT;
  public readonly response : QuestionResponse<QT>;

  public constructor (spec: QuestionSpecification<QT>) {
    this.spec = spec;
    this.id = spec.id;
    this.tags = spec.tags ?? [];
    this.pointsPossible = spec.points;
    this.kind = <QT>spec.response.kind;
    this.response = spec.response;
    this.html_description = mk2html(spec.mk_description);
  }

  public renderResponse() {
    return `<div class="examma-ray-question-response" data-response-kind="${this.kind}">${render_response(this.response, this.id)}</div>`;
  }

};

export interface StudentInfo {
  readonly uniqname: string;
  readonly name: string;
}

export class AssignedQuestion<QT extends ResponseKind = ResponseKind> {

  public readonly pointsEarned?: number;
  public readonly nonExceptionPoints?: number;
  public readonly gradedBy?: Grader<QT>
  public readonly exception?: Exception;

  public readonly submission: SubmissionType<QT>;

  public readonly displayIndex;

  public constructor(
    public readonly exam: Exam,
    public readonly question: Question<QT>,
    public readonly sectionIndex : number,
    public readonly partIndex : number,
    public readonly rawSubmission: string,
  ) {
    this.displayIndex = (sectionIndex+1) + "." + (partIndex+1);
    this.submission = parse_submission(question.kind, rawSubmission);
  }

  public grade(grader: Grader<QT>) {
    console.log("here");
    this.setPointsEarned(grader.grade(
      this.question,
      this.submission
    ));
    (<Mutable<this>>this).gradedBy = grader;
  }

  private setPointsEarned(points: number) {
    (<Mutable<this>>this).pointsEarned = Math.min(this.question.pointsPossible, Math.max(points, 0));
  }

  public addException(exception: Exception) {
    (<Mutable<this>>this).exception = exception;
    (<Mutable<this>>this).nonExceptionPoints = this.pointsEarned;
    this.setPointsEarned(exception.adjustedScore);
  }

  public render(mode: RenderMode) {

    let question_header_html = `<b>${this.displayIndex}</b>`;
    if (mode === RenderMode.ORIGINAL) {
      question_header_html += ` ${renderPointsWorthBadge(this.question.pointsPossible)}`;
      return `
        <div id="question-${this.question.id}" data-question-id="${this.question.id}" data-question-display-index="${this.displayIndex}" class="examma-ray-question card-group">
          <div class="card">
            <div class="card-header">
              ${question_header_html}
            </div>
            <div class="card-body">
              <div class="examma-ray-question-description">
                ${this.question.html_description}
              </div>
              ${this.question.renderResponse()}
            </div>
          </div>
        </div>
      `;
    }
    else {
      question_header_html += ` ${this.isGraded() ? renderScoreBadge(this.pointsEarned, this.question.pointsPossible): renderUngradedBadge(this.question.pointsPossible)}`;
    
      let graded_html: string;
      let exception_html = "";
      
      if (this.isGraded()) {
        graded_html = this.gradedBy.renderReport(this.question, this.submission);
        exception_html = this.renderExceptionIfPresent();
      }
      else {
        graded_html = `
        <div class="alert alert-danger" role="alert">
          NOT GRADED
        </div>`; 
      }

      return renderQuestion(this.question.id, this.displayIndex, this.question.html_description, question_header_html, exception_html, graded_html);
    }
  }

  private renderExceptionIfPresent() {
    if (!this.exception) {
      return "";
    }

    return `<div class="alert alert-warning">
      <p><strong>An exception was applied when grading this question.</strong></p>
      <p>Your score on this question was adjusted from <strong>${this.nonExceptionPoints}</strong> to <strong>${this.pointsEarned}</strong>.</p>
      ${mk2html(this.exception.explanation)}
    </div>`;
  }

  public isGraded() : this is GradedQuestion<QT> {
    return !!this.gradedBy;
  }
  
}

interface GradedQuestion<QT extends ResponseKind> extends AssignedQuestion<QT> {
  readonly pointsEarned: number;
  readonly gradedBy: Grader<QT>
}




// TODO rework this function ew
export function renderQuestion(id: string, displayIndex: string, description: string, header: string, exception: string, gradingReport: string) {
  return `
  <div id="question-${id}" data-question-id="${id}" data-question-display-index="${displayIndex}" class="examma-ray-question card-group">
    <div class="card">
      <div class="card-header">
        ${header}
      </div>
      <div class="card-body">
        <div class="examma-ray-question-description">
          ${description}
        </div>
        <div class="examma-ray-question-exception">
          ${exception}
        </div>
        <div class="examma-ray-grading-report">
          ${gradingReport}
        </div>
      </div>
    </div>
  </div>`;
}




export class Section {

  // public readonly raw_description: string;
  // public readonly description: string;
  // public readonly section: Section;
  public readonly spec: SectionSpecification;
  public readonly id: string;
  public readonly title: string;
  public readonly html_description: string;
  public readonly html_reference?: string;
  public readonly questions: (QuestionSpecification | Question | QuestionChooser)[];

  public constructor (spec: SectionSpecification) {
    this.spec = spec;
    this.id = spec.id;
    this.title = spec.title;
    this.html_description = mk2html(spec.mk_description);
    this.html_reference = spec.mk_reference && mk2html(spec.mk_reference);
    this.questions = Array.isArray(spec.content) ? spec.content : [spec.content];

    // let json = JSON.parse(readFileSync(`sections/${sectionIndex}.json`, 'utf8'));
    // let question = (<any[]>json["questions"]).find(q => parseInt(q.index) === partIndex) ?? json["questions"][partIndex-1];
    // assert(question, `Missing question ${partIndex} in section ${sectionIndex}.json`);
    // this.data = question["data"];
    // // this.raw_description = question["questionDescription"] ?? "";


    // this.section = {
    //   index: this.sectionIndex,
    //   title: <string>json["title"],
    //   raw_description: <string>json["sectionDescription"],
    //   description: mk2html(<string>json["sectionDescription"]),
    //   raw_referenceMaterial: <string>json["referenceMaterial"],
    //   referenceMaterial: mk2html(<string>json["referenceMaterial"]),
    // }
  }

  public buildRandomizedSection(
    exam: Exam, student: StudentInfo, sectionIndex: number,
    rand: Randomizer = new Randomizer(student.uniqname + "_" + exam.id + "_" + this.id))
  {
    return new AssignedSection(
      this,
      sectionIndex,
      this.questions.flatMap(chooser => 
        typeof chooser === "function" ? chooser(exam, student, rand) :
        chooser instanceof Question ? [chooser] :
        new Question(chooser)
      ).map((q, partIndex) => new AssignedQuestion(exam, q, sectionIndex, partIndex, ""))
    );
  }
    

}


const NO_REFERNECE_MATERIAL = "This section has no reference material."

export class AssignedSection {

  public readonly displayIndex: string;

  public readonly pointsPossible: number;
  public readonly pointsEarned?: number;
  public readonly isFullyGraded: boolean = false;

  public constructor(
    public readonly section: Section, 
    public readonly sectionIndex : number,
    public readonly assignedQuestions: readonly AssignedQuestion[])
  {
    this.displayIndex = "" + (sectionIndex+1);
    this.pointsPossible = assignedQuestions.reduce((p, q) => p + q.question.pointsPossible, 0);
  }

  public gradeAllQuestions(ex: AssignedExam, graders: GraderMap) {
    this.assignedQuestions.forEach(aq => {
      let grader = graders[aq.question.id];
      if (grader) {
        assert(isGrader(grader, aq.question.kind), `Grader for type "${grader.questionType}" cannot be used for question ${aq.displayIndex}, which has type "${aq.question.kind}".`);
        aq.grade(grader);
      }
    });
    asMutable(this).pointsEarned = <number>this.assignedQuestions.reduce((prev, aq) => prev + aq.pointsEarned!, 0);
    asMutable(this).isFullyGraded =this.assignedQuestions.every(aq => aq.isGraded());
  }

  private renderHeader(mode: RenderMode) {
    let badge = mode === RenderMode.ORIGINAL
      ? renderPointsWorthBadge(this.pointsPossible, "badge-light")
      : this.isFullyGraded
        ? renderScoreBadge(this.pointsEarned!, this.pointsPossible)
        : renderUngradedBadge(this.pointsPossible);
    let heading = mode === RenderMode.ORIGINAL
      ? `${this.displayIndex}: ${this.section.title} ${badge}`
      : `${badge} ${this.displayIndex}: ${this.section.title}`;

    return `
      <div class="examma-ray-section-heading">
        <div class="badge badge-primary">${heading}</div>
      </div>`;
  }

  public render(mode: RenderMode) {
    return `
      <div id="section-${this.section.id}" class="examma-ray-section" data-section-id="${this.section.id}" data-section-display-index="${this.displayIndex}">
        <hr />
        <table class="examma-ray-section-contents">
          <tr>
            <td>
              ${this.renderHeader(mode)}
              <div class="examma-ray-section-description">${this.section.html_description}</div>
              ${this.assignedQuestions.map(aq => aq.render(mode)).join("<br />")}
            </td>
            <td style="width: 35%;">
              <div class="examma-ray-section-reference">
                <h6>Reference Material (Section ${this.displayIndex})</h6>
                ${this.section.html_reference ?? NO_REFERNECE_MATERIAL}
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;
  }
}

export class AssignedExam {

  public readonly pointsPossible: number;
  public readonly pointsEarned?: number;
  public readonly isFullyGraded: boolean = false;

  public constructor(
    public readonly exam: Exam,
    public readonly student: StudentInfo,
    public readonly assignedSections: readonly AssignedSection[]
  ) {
    this.pointsPossible = assignedSections.reduce((p, s) => p + s.pointsPossible, 0);

    let sectionIds = assignedSections.map(s => s.section.id);
    assert(new Set(sectionIds).size === sectionIds.length, `This exam contains a duplicate section. Section IDs are:\n  ${sectionIds.sort().join("\n  ")}`);
    let questionIds = assignedSections.flatMap(s => s.assignedQuestions.map(q => q.question.id));
    assert(new Set(sectionIds).size === sectionIds.length, `This exam contains a duplicate question. Question IDs are:\n  ${sectionIds.sort().join("\n  ")}`);
  }

  public gradeAll(graders: GraderMap) {
    console.log(`Grading exam for: ${this.student.uniqname}...`);
    this.assignedSections.forEach(s => s.gradeAllQuestions(this, graders));
    asMutable(this).pointsEarned = <number>this.assignedSections.reduce((prev, s) => prev + s.pointsEarned!, 0);
    asMutable(this).isFullyGraded = this.assignedSections.every(s => s.isFullyGraded);
  }

  public renderGrade() {
    return this.isFullyGraded ?
      +(this.pointsEarned!.toFixed(2)) + "/" + this.pointsPossible :
      "?/" + this.pointsPossible;
  }

  public renderNav(mode: RenderMode) {
    return `
      <ul class = "nav" style="display: unset; font-weight: 500">
        ${this.assignedSections.map(s => {
          let scoreBadge = 
            mode === RenderMode.ORIGINAL ? renderPointsWorthBadge(s.pointsPossible, "btn-secondary") :
            s.isFullyGraded ? renderScoreBadge(s.pointsEarned!, s.pointsPossible) :
            renderUngradedBadge(s.pointsPossible);
          return `<li class = "nav-item"><a class="nav-link text-truncate" style="padding: 0.1rem" href="#section-${s.section.id}">${scoreBadge} ${s.displayIndex + ": " + s.section.title}</a></li>`
        }).join("")}
      </ul>`
  }

  public renderSaverButton() {
    return `
      <div class="examma-ray-exam-saver-status">
        <div><button id="exam-saver-button" class="btn btn-primary" data-toggle="modal" data-target="#exam-saver" aria-expanded="false" aria-controls="exam-saver"></button></div>
        <div id="examma-ray-exam-saver-last-save" style="margin: 5px; visibility: hidden;"></div>
      </div>`
  }

  public render(mode: RenderMode) {
    return `<div id="examma-ray-exam" class="container-fluid" data-uniqname="${this.student.uniqname}" data-name="${this.student.name}" data-exam-id="${this.exam.id}">
      <div class="row">
        <div class="bg-light" style="position: fixed; width: 200px; top: 0; left: 0; bottom: 0; padding-left: 5px; z-index: 10; overflow-y: auto; border-right: solid 1px #dedede; font-size: 85%">
          <h3 class="text-center pb-1 border-bottom">
            ${mode === RenderMode.ORIGINAL ? renderPointsWorthBadge(this.pointsPossible, "btn-secondary") : this.renderGrade()}
          </h3>
          ${this.renderNav(mode)}
          ${mode === RenderMode.ORIGINAL ? this.renderSaverButton() : ""}
        </div>
        <div style="margin-left: 210px; width: calc(100% - 220px);">
          ${this.exam.renderHeader(this.student)}
          ${this.assignedSections.map(section => section.render(mode)).join("<br />")}

        </div>
      </div>
    </div>`;
  }

}

export function createBlankAnswers(ex: AssignedExam) : ExamAnswers {
  return {
    exam_id: ex.exam.id,
    student: ex.student,
    timestamp: Date.now(),
    validated: false,
    sections: ex.assignedSections.map(s => ({
      id: s.section.id,
      display_index: s.displayIndex,
      questions: s.assignedQuestions.map(q => ({
        id: q.question.id,
        display_index: q.displayIndex,
        kind: q.question.kind,
        response: ""
      }))
    }))
  };
}

export class Randomizer {

  private rng: RandomSeed;

  public constructor(seed: string) {
    this.rng = createRNG(seed);
  }

  public float() {
    return this.rng.random;
  }

  public range(n: number) {
    return this.rng.range(n);
  };

  public choose<T>(choices: readonly T[]) {
    assert(choices.length > 0, "No choices available.");
    return choices[this.rng.range(choices.length)];
  };
  
  public chooseN<T>(choices: readonly T[], n: number) {
    assert(choices.length >= n, "Number to randomly choose is larger than number of choices.");
    return choices
      .slice()
      .map(c => ({i: this.rng.random(), c: c}))
      .sort((a, b) => a.i - b.i)
      .map(x => x.c)
      .slice(0,n);
  }

}

export const DEFAULT_SAVER_MESSAGE_CANVAS = `
  Click the button below to save a copy of your answers as a \`.json\`
  file. You may save as many times as you like. You can also restore answers
  from a previously saved file.
  
  **Important!** You MUST submit your answers \`.json\` file to **Canvas**
  BEFORE exam time is up. This webpage does not save anything to anywhere.
  It is up to you to download your answer file and turn it in on **Canvas**.`;

export const CHOOSE_ALL = Symbol("choose_all");

export type QuestionChooser = (exam: Exam, student: StudentInfo, rand: Randomizer | typeof CHOOSE_ALL) => readonly Question[];

export type SectionSpecification = {
  readonly id: string;
  readonly title: string;
  readonly mk_description: string;
  readonly mk_reference?: string;
  readonly content: QuestionSpecification | Question | QuestionChooser | (QuestionSpecification | Question | QuestionChooser)[];
}

export function BY_ID(id: string, questionBank: QuestionBank) {
  return (exam: Exam, student: StudentInfo, rand: Randomizer | typeof CHOOSE_ALL) => {
    let q = questionBank.getQuestionById(id);
    assert(q, `No question with ID: ${id}.`);
    return [q];
  }
}

export function RANDOM_BY_TAG(tag: string, n: number, questionBank: QuestionBank) {
  return (exam: Exam, student: StudentInfo, rand: Randomizer | typeof CHOOSE_ALL) => {
    let qs = questionBank.getQuestionsByTag(tag);
    if (rand === CHOOSE_ALL) {
      return qs;
    }
    assert(n <= qs.length, `Error - cannot choose ${n} questions for tag "${tag}" that only has ${qs.length} associated questions.`);
    return rand.chooseN(qs, n);
  }
}

export function RANDOM_ANY(n: number, questionBank: QuestionBank | (QuestionSpecification | Question)[]) {
  if (!(questionBank instanceof QuestionBank)) {
    questionBank = new QuestionBank(questionBank);
  }
  return (exam: Exam, student: StudentInfo, rand: Randomizer | typeof CHOOSE_ALL) => {
    let qs = (<QuestionBank>questionBank).questions;
    if (rand === CHOOSE_ALL) {
      return qs;
    }
    assert(n <= qs.length, `Error - cannot choose ${n} questions from a question bank that only has ${qs.length} questions.`);
    return rand.chooseN(qs, n);
  }
}


export type SectionChooser = (exam: Exam, student: StudentInfo, rand: Randomizer | typeof CHOOSE_ALL) => readonly Section[];

export function RANDOM_SECTION(n: number, sections: (SectionSpecification | Section)[]) {
  return (exam: Exam, student: StudentInfo, rand: Randomizer | typeof CHOOSE_ALL) => {
    if (rand === CHOOSE_ALL) {
      return sections.map(s => s instanceof Section ? s : new Section(s));
    }
    assert(n <= sections.length, `Error - cannot choose ${n} sections from a set of ${sections.length} sections.`);
    return rand.chooseN(sections, n).map(s => s instanceof Section ? s : new Section(s));
  }
}

export type ExamSpecification = {
  id: string,
  title: string,
  pointsPossible: number,
  mk_intructions: string,
  mk_announcements?: string[],
  frontend_js_path: string,
  frontend_graded_js_path: string,
  sections: readonly (SectionSpecification | Section | SectionChooser)[]
};

export class Exam {

  public readonly id: string;
  public readonly title: string;

  public readonly pointsPossible: number;

  public readonly html_instructions: string;
  public readonly html_announcements: readonly string[];

  public readonly frontendJsPath: string;
  public readonly frontendGradedJsPath: string;

  public readonly sections: readonly (SectionSpecification | Section | SectionChooser)[];

  public constructor(spec: ExamSpecification) {
    this.id = spec.id;
    this.title = spec.title;
    this.html_instructions = mk2html(spec.mk_intructions);
    this.pointsPossible = spec.pointsPossible;
    this.html_announcements = spec.mk_announcements?.map(a => mk2html(a)) ?? [];
    this.frontendJsPath = spec.frontend_js_path;
    this.frontendGradedJsPath = spec.frontend_graded_js_path;
    this.sections = spec.sections;
  }

  public addAnnouncement(announcement_mk: string) {
    asMutable(this.html_announcements).push(mk2html(announcement_mk));
  }

  public renderHeader(student: StudentInfo) {
    return `
      <div class="examma-ray-header">
        <div class="text-center mb-3 border-bottom">
          <h2>${this.title}</h2>
          <h6>${student.name} (${student.uniqname})</h6>
        </div>
        <div>
          ${this.renderInstructions()}
          ${this.renderAnnouncements()}
        </div>
      </div>
    `;
  }

  public renderInstructions() {
    return `<div class="examma-ray-instructions">
      ${this.html_instructions}
    </div>`
  }

  public renderAnnouncements() {
    return `<div class="examma-ray-announcements">
      ${this.html_announcements.map(a => `
        <div class="alert alert-warning alert-dismissible fade show" style="display: inline-block; max-width: 40rem;" role="alert">
          ${a}
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>`
      )}
    </div>`;
  }

  // public writeScoresCsv() {
  //   mkdirSync("out/", {recursive: true});
  //   let data = [...this.submissions].sort((a, b) => a.student.uniqname.localeCompare(b.student.uniqname))
  //     .filter(s => s.pointsEarned)
  //     .map(s => {
  //       let student_data : {[index:string]: any} = {};
  //       student_data["uniqname"] = s.student.uniqname;
  //       student_data["total"] = s.pointsEarned;
  //       s.assignedQuestions.forEach(aq => student_data[aq.unifiedIndex] = aq.pointsEarned);
  //       return student_data;
  //     });
      
  //   stringify(
  //     data,
  //     {
  //       header: true,
  //       columns: ["uniqname", "total", ...this.questionBank.map(q => q.unifiedIndex)]
  //     },
  //     function (err, output) {
  //       writeFileSync('out/scores.csv', output);
  //     }
  //   );
  // }

}

export class QuestionBank {

  public readonly questions: readonly Question[] = [];
  private readonly questionsById: {[index: string] : Question | undefined } = {};
  private readonly questionsByTag: {[index: string] : Question[] | undefined } = {};

  public constructor(questions: readonly (Question | QuestionSpecification)[]) {
    questions.forEach(q => this.registerQuestion(q));
  }

  public registerQuestion(q: Question | QuestionSpecification) {
    if (!(q instanceof Question)) {
      q = new Question(q);
    }
    asMutable(this.questions).push(q);
    this.questionsById[q.id] = q;
    q.tags.forEach(tag => 
      (this.questionsByTag[tag] ??= []).push(<Question>q)
    );
  }

  public registerQuestions(qs: QuestionSpecification[]) {
    qs.forEach(q => this.registerQuestion(new Question(q)));
  }

  public getQuestionById(id: string) {
    return this.questionsById[id];
  }

  public getQuestionsByTag(tag: string) {
    return this.questionsByTag[tag] ?? [];
  }
}

export function writeAGFile(mode: RenderMode, ex: AssignedExam, filename: string, body: string) {
  writeFileSync(filename, `
      <!DOCTYPE html>
    <html>
    <meta charset="UTF-8">
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" integrity="sha384-DfXdz2htPH0lsSSs5nCTpuj/zy4C+OGpamoFVy38MVBnE+IbbVYUew+OrCXaRkfj" crossorigin="anonymous"></script>
    <script src="https://unpkg.com/@popperjs/core@2" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css" integrity="sha384-TX8t27EcRE3e/ihU7zmQxVncDAy5uIKz4rEkgIXeMed4M0jlfIDPvg6uqKI2xXr2" crossorigin="anonymous">
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-ho+j7jyWK8fNQe+A12Hb8AhRq26LrZ/JpcUGGOn+Y7RsweNrtN/tE3MoK7ZeZDyx" crossorigin="anonymous"></script>
    <script src="${mode === RenderMode.ORIGINAL ? ex.exam.frontendJsPath : ex.exam.frontendGradedJsPath}"></script>
    <script>
      $(function() {
        $('button.examma-ray-blank-saver').on("click", function() {
          let blank_num = $(this).data("blank-num");
          let checked = $("input[type=checkbox]:checked").filter(function() {
            return $(this).data("blank-num") === blank_num;
          }).map(function() {
            return '"'+$(this).data("blank-submission").replace('"','\\\\"')+'"';
          }).get().join(",\\n");
          $(".checked-submissions-content").html(he.encode(checked));
          $(".checked-submissions-modal").modal("show")
        })
      });

    </script>
    <style>
      


    </style>
    <body>
      ${body}


      <div id="exam-saver" class="exam-saver-modal modal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Answers File</h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body" style="text-align: center;">
              <div class="alert alert-info">${mk2html(DEFAULT_SAVER_MESSAGE_CANVAS)}</div>
              <div id="exam-saver-download-status" style="margin-bottom: 5px;"></div>
              <div><a id="exam-saver-download-link" class="btn btn-primary">${FILE_DOWNLOAD} Download Answers</a></div>
              <br />
              <div style="margin-bottom: 5px;">Or, you may restore answers you previously saved to a file. <b>WARNING!</b> This will overwrite ALL answers on this page.</div>
              <div>
                <button id="exam-saver-load-button" class="btn btn-danger disabled" disabled>${FILE_UPLOAD} Load Answers</button>
                <input id="exam-saver-file-input" type="file"></a>
              </div>
            </div>
          </div>
        </div>
      </div>


      <div id="exam-welcome-restored-modal" class="modal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${ex.exam.title}</h5>
            </div>
            <div class="modal-body" style="text-align: center;">
              <div class="alert alert-info">This page was reloaded, and we've restored your answers from a local backup.</div>
              <div>
                <button class="btn btn-success" data-dismiss="modal">${FILE_CHECK} OK</button>
              </div>
            </div>
          </div>
        </div>
      </div>


      <div id="exam-welcome-normal-modal" class="modal" data-keyboard="false" data-backdrop="static" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${ex.exam.title}</h5>
            </div>
            <div class="modal-body" style="text-align: center;">
            <div class="alert alert-info">This exam is for <b>${ex.student.uniqname}</b>. If this is not you, please close this page.</div>
            <div class="alert alert-info">This page shows your exam questions and gives you a place to work. <b>However, we will not grade anything here</b>. You must <b>download</b> an "answers file" and submit that to <b>Canvas</b> BEFORE the exam ends</b>.</div>
            <div class="alert alert-warning">If something goes wrong (e.g. in case your computer crashes, you accidentally close the page, etc.), this page will attempt to restore your work when you come back. <b>Warning!</b> If you take the exam in private/incognito mode, of if you have certain privacy extensions/add-ons enabled, this likely won't work.</div>
            <div>
              <button class="btn btn-primary" data-dismiss="modal">I am <b>${ex.student.uniqname}</b> and I understand</button>
            </div>
            </div>
          </div>
        </div>
      </div>


      <div id="exam-welcome-no-autosave-modal" class="modal" data-keyboard="false" data-backdrop="static" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${ex.exam.title}</h5>
            </div>
            <div class="modal-body" style="text-align: center;">
              <div class="alert alert-info">This exam is for <b>${ex.student.uniqname}</b>. If this is not you, please close this page.</div>
              <div class="alert alert-info">This page shows your exam questions and gives you a place to work. <b>However, we will not grade anything here</b>. You must <b>download</b> an "answers file" and submit that to <b>Canvas</b> BEFORE the exam ends</b>.</div>
              <div class="alert alert-danger">It appears your browser will not support backing up your answers to local storage (e.g. in case your computer crashes, you accidentally close the page, etc.).<br /><br />While you may still take the exam like this, we do not recommend it. Make sure you are <b>not</b> using private/incognito mode, temporarily disable privacy add-ons/extensions, or try a different web browser to get autosave to work.</div>
              <div>
                <button class="btn btn-primary" data-dismiss="modal">I am <b>${ex.student.uniqname}</b> and I understand</button>
              </div>
            </div>
          </div>
        </div>
      </div>


    </body>
    </html>`, { encoding: "utf-8" });
    // pdf.create(`<html><body>${s.renderAllReports(graderMap)}</body></html>`, { format: 'Letter' }).toFile('test.pdf', function(err, res) {
    //   if (err) return console.log(err);
    //   console.log(res); // { filename: '/app/businesscard.pdf' }
    // });
}




// export function run_autograder(exam: Exam) {
//   let argv = minimist(process.argv.slice(2), {
//     alias : {
//         "a": "all_questions",
//         "n": "no_reports"
//     },
//     default : {
//       "no_reports": false
//     }
//     });
      
//     let isAllQuestions: string = argv["all_questions"];
//     let isRenderReports: boolean = !argv["no_reports"];
    
//     (async () => {
    
//         if (isAllQuestions) {
//             console.log("Creating one exam with all questions with answers drawn from random students...");
//             await exam.loadRandomizedStudent("matlab_exam_w21_answerkey.csv");
//         }
//         else {
//             console.log("Loading submissions for all students...");
//             await exam.loadSubmissions("matlab_exam_w21_morning.csv");
//             await exam.loadSubmissions("matlab_exam_w21_evening.csv");
//             await exam.loadSubmissions("matlab_exam_w21_makeup.csv");
//             await exam.loadSubmissions("matlab_exam_w21_nacosw.csv");
//         }
        
//         console.log("Grading exam...");
//         exam.gradeAllStudents();
    
//         console.log("Rendering question details...");
//         exam.questions.forEach(q => renderStatsToFile(exam, q.unifiedIndex));

//         console.log("Rendering overview...");
//         renderOverview(exam);

//         if (isRenderReports) {
//             console.log("Rendering student reports...");
//             exam.renderReports();
//         }
    
    
//         console.log("Writing scores csv...");
//         exam.writeScoresCsv();
//     })();
// }

// export function run_autograder(exam: Exam) {
//   let argv = minimist(process.argv.slice(2), {
//     alias : {
//         "a": "all_questions",
//         "n": "no_reports"
//     },
//     default : {
//       "no_reports": false
//     }
//     });
      
//     let isAllQuestions: string = argv["all_questions"];
//     let isRenderReports: boolean = !argv["no_reports"];
    
//     (async () => {
    
//         if (isAllQuestions) {
//             console.log("Creating one exam with all questions with answers drawn from random students...");
//             await exam.loadRandomizedStudent("matlab_exam_w21_answerkey.csv");
//         }
//         else {
//             console.log("Loading submissions for all students...");
//             await exam.loadSubmissions("matlab_exam_w21_morning.csv");
//             await exam.loadSubmissions("matlab_exam_w21_evening.csv");
//             await exam.loadSubmissions("matlab_exam_w21_makeup.csv");
//             await exam.loadSubmissions("matlab_exam_w21_nacosw.csv");
//         }
        
//         console.log("Grading exam...");
//         exam.gradeAllStudents();
    
//         console.log("Rendering question details...");
//         exam.questions.forEach(q => renderStatsToFile(exam, q.unifiedIndex));

//         console.log("Rendering overview...");
//         renderOverview(exam);

//         if (isRenderReports) {
//             console.log("Rendering student reports...");
//             exam.renderReports();
//         }
    
    
//         console.log("Writing scores csv...");
//         exam.writeScoresCsv();
//     })();
// }
