/**
 * ## Specification
 * 
 * The 
 * 
 * @module
 */

import { CHOOSE_ALL, Randomizer } from "./randomization";
import { QuestionBank } from "./QuestionBank";
import { ResponseKind } from "./response/common";
import { ResponseSpecification } from "./response/responses";
import { DEFAULT_SKIN, QuestionSkin } from "./skins";
import { assert } from "./util";
import { Exam, Question, Section } from "./exam_components";

export function isValidID(id: string) {
  return /^[a-zA-Z][a-zA-Z0-9_\-]*$/.test(id);
}


export interface StudentInfo {
  readonly uniqname: string;
  readonly name: string;
}

export type ExamSpecification = {

  readonly component_kind?: "specification",

  /**
   * A unique ID for the exam. Also used as part of the composite seed for UUID generation
   * by an [[ExamGenerator]] using the `"uniqname"` or "uuidv5" strategies.
   */
  readonly id: string,

  /**
   * Title shown at the top of the exam.
   */
  readonly title: string,

  /**
   * Markdown-formatted exam instructions, shown at the top of the exam.
   */
  readonly mk_intructions: string,

  /**
   * Specifies the sections of this exam. Each entry in the array may either specify
   * a particular section or a "chooser" that selects one (or more) from a set of possible
   * sections that an individual student might be assigned.
   * @see [[SectionSpecification]]
   * @see [[SectionChooser]]
*/
  readonly sections: readonly (SectionSpecification | SectionChooser)[],
  readonly mk_announcements?: string[],
  readonly mk_questions_message?: string,
  readonly mk_download_message?: string,
  readonly mk_bottom_message?: string,
  readonly enable_regrades?: boolean
};



/**
 * A `SectionChooser` selects an array of questions given an exam, a student,
 * and a source of randomness. You may define your own or use a predefined chooser:
 * - [[RANDOM_SECTION]]
 */
export interface SectionChooser {
  component_kind: "chooser";
  choose(exam: Exam, student: StudentInfo, rand: Randomizer): readonly Section[];
  getById(section_id: string): Section;
}

export function chooseSections(chooser: Section | SectionChooser, exam: Exam, student: StudentInfo, rand: Randomizer) {
  return chooser.component_kind === "component" ? [chooser] : chooser.choose(exam, student, rand);
}

/**
 * 
 * @param n 
 * @param sections 
 * @returns 
 */
export function RANDOM_SECTION(n: number, sections: readonly (SectionSpecification | Section)[]) {
  return (exam: Exam, student: StudentInfo, rand: Randomizer) => {
    if (rand === CHOOSE_ALL) {
      return sections.map(s => s instanceof Section ? s : Section.create(s));
    }
    assert(n <= sections.length, `Error - cannot choose ${n} sections from a set of ${sections.length} sections.`);
    return rand.chooseN(sections, n).map(s => s instanceof Section ? s : Section.create(s));
  }
}





export type SectionSpecification = {
  readonly component_kind?: "specification",
  readonly id: string,
  readonly title: string,
  readonly mk_description: string,
  readonly mk_reference?: string,
  readonly questions: readonly (QuestionSpecification | QuestionChooser)[],
  readonly skins?: SkinChooser,
  reference_width?: number,
}



export interface QuestionChooser {
  component_kind: "chooser",
  choose(exam: Exam, student: StudentInfo, rand: Randomizer) : readonly Question[];
  getById(id: string) : Question | undefined;
}

export function chooseQuestions(chooser: Question | QuestionChooser, exam: Exam, student: StudentInfo, rand: Randomizer) {
  return chooser.component_kind === "component" ? [chooser] : chooser.choose(exam, student, rand);
}

// export function BY_ID(id: string, questionBank: QuestionBank) {
//   return (exam: Exam, student: StudentInfo, rand: Randomizer) => {
//     let q = questionBank.getQuestionById(id);
//     assert(q, `No question with ID: ${id}.`);
//     return [q];
//   }
// }

export function RANDOM_BY_TAG(tag: string, n: number, questionBank: QuestionBank) {
  return (exam: Exam, student: StudentInfo, rand: Randomizer) => {
    let qs = questionBank.getQuestionsByTag(tag);
    if (rand === CHOOSE_ALL) {
      return qs;
    }
    assert(n <= qs.length, `Error - cannot choose ${n} questions for tag "${tag}" that only has ${qs.length} associated questions.`);
    return rand.chooseN(qs, n);
  }
}

export function RANDOM_QUESTION(n: number, questionBank: QuestionBank | readonly (QuestionSpecification | Question)[]) {
  if (!(questionBank instanceof QuestionBank)) {
    questionBank = new QuestionBank(questionBank);
  }
  return (exam: Exam, student: StudentInfo, rand: Randomizer) => {
    let qs = (<QuestionBank>questionBank).questions;
    if (rand === CHOOSE_ALL) {
      return qs;
    }
    assert(n <= qs.length, `Error - cannot choose ${n} questions from a question bank that only has ${qs.length} questions.`);
    return rand.chooseN(qs, n);
  }
}



export type QuestionSpecification<QT extends ResponseKind = ResponseKind> = {
  readonly component_kind?: "specification",
  readonly id: string,
  readonly points: number,
  readonly mk_description: string,
  readonly response: ResponseSpecification<QT>,
  readonly tags?: readonly string[],
  readonly skins?: SkinChooser
};





export type SkinChooser = {
  choose: (exam: Exam, student: StudentInfo, rand: Randomizer) => readonly QuestionSkin[],
  getById: (id: string) => QuestionSkin | undefined
};

export const DEFAULT_SKIN_GENERATOR : SkinChooser = {
  choose: (exam: Exam, student: StudentInfo, rand: Randomizer) => {
    return [DEFAULT_SKIN];
  },
  getById: (id: string) => DEFAULT_SKIN
}

export function RANDOM_SKIN(skins: readonly QuestionSkin[]) : SkinChooser {
  let skinMap : {[index: string]: QuestionSkin | undefined} = {};
  skins.forEach(s => skinMap[s.id] = s);
  return {
    choose: (exam: Exam, student: StudentInfo, rand: Randomizer) => {
      assert(skins.length > 0, `Error - array of skin choices is empty.`);
      return rand === CHOOSE_ALL ? skins : [rand.choose(skins)]
    },
    getById: (id: string) => skinMap[id]
  };
}



export function CUSTOMIZE(spec: QuestionSpecification, customizations: Partial<Exclude<QuestionSpecification, "response">>) : QuestionSpecification;
export function CUSTOMIZE(spec: SectionSpecification, customizations: Partial<Exclude<SectionSpecification, "response">>) : SectionSpecification;
export function CUSTOMIZE(spec: ExamSpecification, customizations: Partial<Exclude<ExamSpecification, "response">>) : ExamSpecification;
export function CUSTOMIZE(spec: QuestionSpecification | SectionSpecification | ExamSpecification, customizations: Partial<Exclude<QuestionSpecification | SectionSpecification | ExamSpecification, "response">>) : QuestionSpecification | SectionSpecification | ExamSpecification {
  return Object.assign({}, spec, customizations);
}

