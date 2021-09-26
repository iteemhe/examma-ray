/**
 * ## Select Lines Response
 * 
 * A select lines response gives students a sequence of lines of code and asks them to choose the ones
 * that are correct and should become part of a final solution. The relative ordering of the lines
 * is fixed, but each may be turned on/off. Lines may be "forced", meaning they cannot be turned off
 * and are always included in the final solution. A "line" may in fact contain several lines if its
 * specified content contains newline characters.
 * 
 * The response is rendered as a sequence of lines with checkboxes. Clicking a line toggles whether
 * it is selected or not. Students may also preview their final solution, composed of only the
 * selected lines.
 * 
 * The [[SLSpecification]] type alias represents the information needed to specify an FITB
 * response as part of a question.
 * 
 * Here's an example of a question with a select lines response.
 * 
 * ```typescript
 * export const Practice_Question_Big_Three_V1_Assignment_Op : QuestionSpecification = {
 *   question_id: "practice_big_three_v1_assignment_op",
 *   tags: [],
 *   points: 9,
 *   mk_description:
 * `
 * Implement the **assignment operator** as it would be defined inside the
 * \`{{class_name}}\` class by selecting from the lines of code given below.
 * Click all lines that should be included. You are not able to change the
 * relative ordering of the lines. You may use the buttons to toggle between
 * viewing all choices or just the ones you have selected to preview your
 * chosen code. When finished, the **selected lines should form a working
 * function** that performs a **deep copy** where appropriate and **avoids
 * undefined behavior or memory leaks**. Some lines contain **mistakes**
 * or are **unnecessary** for the function - these lines should not be selected.
 * `,
 *   response: {
 *     kind: "select_lines",
 *     code_language: "cpp",
 *     choices: [
 *       {
 *         kind: "item",
 *         text: "{{class_name}} *operator=(const {{class_name}} &rhs) {",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "{{class_name}} &operator=(const {{class_name}} &rhs) {",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  if (&this == rhs) { return *this; }",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  if (this == &rhs) { return *this; }",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  delete {{mem_array}};",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  delete[] {{mem_array}};",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  delete {{mem_vector}};",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  for(size_t i=0; i < {{mem_vector}}.size(); ++i) {\n    delete {{mem_vector}}[i];\n  }  ",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  while(!{{mem_vector}}.empty()) {\n    {{mem_vector}}.pop_back();\n  }",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  {{mem_array}} = rhs.{{mem_array}};",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  {{mem_array}} = new {{array_elt_class_name}}[{{array_capacity}}];",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  for(int i = 0; i < {{array_capacity}}; ++i) {\n    {{mem_array}}[i] = rhs.{{mem_array}}[i];\n  }",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  for (int i = 0; i < {{array_capacity}}; ++i) {\n    {{mem_array}}[i] = new {{array_elt_class_name}}(rhs.{{mem_array}}[i]);\n  }",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  {{mem_vector}} = rhs.{{mem_vector}};",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  {{mem_vector}} = new vector<{{dynamic_class_name}}>(rhs.{{mem_vector}});",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  for(size_t i=0; i < rhs.{{mem_vector}}.size(); ++i) {\n    {{mem_vector}}.push_back(new {{dynamic_class_name}}(*rhs.{{mem_vector}}[i]));\n  }",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  return *this;",
 *         forced: false
 *       },
 *       {
 *         kind: "item",
 *         text: "  return rhs;",
 *         forced: false
 *       }
 *     ],
 *     footer: "}"
 *   }
 * }
 * ```
 * 
 * ### Select Lines Submissions
 * 
 * A submission for a select lines response is an array of numbers corresponding to the indices
 * of selected lines. The submission may also be [[BLANK_SUBMISSION]] if none were selected.
 * 
 * @module
 */

import { QuestionGrader } from "../core/QuestionGrader";
import { applySkin, highlightCode } from "../core/render";
import { ExamComponentSkin } from "../core/skins";
import { BLANK_SUBMISSION, MALFORMED_SUBMISSION } from "./common";
import { isNumericArray } from "./util";

/**
 * One of the "lines" of code that may be toggled on/off in a select lines response.
 * If `forced` is specified as true, the item will appear as selected and can not
 * be toggled off (it will always be included in the solution).
 */
export type SLItem = {
  kind: "item",
  text: string,
  forced?: boolean
};

export type SLGroup = {
  kind: "group",
  title?: string, // TODO make sure this can be skinned as well once it's implemented
  items: SLItem[]
};


/**
 * Specifies a select lines response as part of a question.
 */
export type SLSpecification = {
  
  /**
   * The discriminant "select_lines" is used to distinguish select lines specifications.
   */
  kind: "select_lines",

  /**
   * The language to use for syntax highlighting. May be any 
   * [hljs supported language](https://highlightjs.readthedocs.io/en/latest/supported-languages.html).
   */
  code_language: string,

  /**
   * The "lines" of code to present as choices for the student.
   */
  choices: (SLGroup | SLItem)[],

  /**
   * Code shown above the set of lines students select from.
   */
  header?: string,

  /**
   * Code shown below the set of lines students select from
   */
  footer?: string,

  /**
   * A sample solution for this response.
   */
  sample_solution?: Exclude<SLSubmission, typeof BLANK_SUBMISSION>,

  /**
   * A default grader for this response.
   */
  default_grader?: QuestionGrader<"select_lines", any>
};

/**
 * A submission for a select lines response is an array of numbers corresponding to the indices
 * of selected lines. The submission may also be [[BLANK_SUBMISSION]] if none were selected.
 */
export type SLSubmission = readonly number[] | typeof BLANK_SUBMISSION;

function SL_PARSER(rawSubmission: string | null | undefined) : SLSubmission | typeof MALFORMED_SUBMISSION {
  if (rawSubmission === undefined || rawSubmission === null || rawSubmission.trim() === "") {
    return BLANK_SUBMISSION;
  }

  try {
    let parsed = JSON.parse(rawSubmission);
    if (isNumericArray(parsed)) {
      return parsed.length > 0 ? parsed : BLANK_SUBMISSION;
    }
    else {
      return MALFORMED_SUBMISSION;
    }
  }
  catch(e) {
    if (e instanceof SyntaxError) {
      return MALFORMED_SUBMISSION;
    }
    else {
      throw e;
    }
  }
}

function SL_RENDERER(response: SLSpecification, question_id: string, question_uuid: string, skin?: ExamComponentSkin) {
  let item_index = 0;
  return `
    <div style="text-align: right; margin-bottom: 5px;">
      <div class="btn-group btn-group-toggle" data-toggle="buttons">
        <label class="btn btn-outline-primary btn-sm active">
          <input class="examma-ray-sl-show-choices-button" type="radio" name="options" autocomplete="off" checked> All Choices
        </label>
        <label class="btn btn-outline-primary btn-sm">
          <input class="examma-ray-sl-show-preview-button" type="radio" name="options" autocomplete="off"> Selected Only
        </label>
      </div>
    </div>
    <div class="examma-ray-sl-header">
      ${response.header ? `<pre><code>${highlightCode(applySkin(response.header, skin), response.code_language)}</code></pre>` : ""}
    </div>
    <div class="examma-ray-sl-choices sl-view-choices">
      ${response.choices.map(
        group => group.kind === "item"
          ? renderSLItem(group, question_uuid, item_index++, response.code_language, skin)
          : group.items.map(item => renderSLItem(item, question_uuid, item_index++, response.code_language, skin)).join("\n")
      ).join("\n")}
    </div>
    <div class="examma-ray-sl-footer">
      ${response.footer ? `<pre><code>${highlightCode(applySkin(response.footer, skin), response.code_language)}</code></pre>` : ""}
    </div>
  `;
}

function renderSLItem(item: SLItem, question_id: string, item_index: number, code_language: string, skin?: ExamComponentSkin) {
  return `
    <div class="examma-ray-sl-line">
      <input type="checkbox" id="${question_id}-sl-choice-${item_index}" value="${item_index}" class="sl-select-input"${item.forced ? " checked=\"checked\" disabled=\"disabled\"" : ""}></input> 
      <label for="${question_id}-sl-choice-${item_index}" class="sl-select-label">
        <pre><code>${highlightCode(applySkin(item.text, skin), code_language)}</code></pre>
      </label><br />
    </div>`;
}


function SL_ACTIVATE(responseElem: JQuery) {
  responseElem.data("sl-view", "choices");
  responseElem.find(".examma-ray-sl-show-choices-button").on("click",
    () => {
      responseElem.find(".examma-ray-sl-choices")
        .addClass("sl-view-choices")
        .removeClass("sl-view-preview");
      responseElem.data("sl-view", "choices");
      responseElem.find(".examma-ray-sl-line").slideDown();
    }
  );
  responseElem.find(".examma-ray-sl-show-preview-button").on("click",
    () => {
      responseElem.data("sl-view", "preview");
      responseElem.find(".examma-ray-sl-line").has("input:not(:checked)").slideUp(400, () => {
        responseElem.find(".examma-ray-sl-choices")
          .addClass("sl-view-preview")
          .removeClass("sl-view-choices");
      });
    }
  );
}

function SL_EXTRACTOR(responseElem: JQuery) {
  let chosen = responseElem.find(".examma-ray-sl-choices input:checked").map(function() {
    return parseInt(<string>$(this).val());
  }).get();
  return chosen.length > 0 ? chosen : BLANK_SUBMISSION;
}

function SL_FILLER(responseElem: JQuery, submission: SLSubmission) {
  
  let inputs = responseElem.find(".examma-ray-sl-choices input");

  // blank out all selections, except those that are disabled
  // which would be the "forced" items in the list of SL choices
  inputs.filter(":not(:disabled)").prop("checked", false);

  if (submission !== BLANK_SUBMISSION) {
    let inputElems = inputs.get();
    submission.forEach(n => $(inputElems[n]).prop("checked", true));
  }

  // Initially revert to showing everything
  responseElem.find(".examma-ray-sl-line").show();
  
  // If we're in preview mode, hide anything that isn't checked
  if (responseElem.data("sl-view") === "preview") {
    responseElem.find(".examma-ray-sl-line").has("input:not(:checked)").hide();
  }
}

export const SL_HANDLER = {
  parse: SL_PARSER,
  render: SL_RENDERER,
  activate: SL_ACTIVATE,
  extract: SL_EXTRACTOR,
  fill: SL_FILLER
};