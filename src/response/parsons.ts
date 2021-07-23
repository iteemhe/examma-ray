import { encode } from "he";
import { QuestionGrader } from "../QuestionGrader";
import { applySkin, mk2html } from "../render";
import { QuestionSkin } from "../skins";
import { assert, assertFalse } from "../util";
import { BLANK_SUBMISSION, MALFORMED_SUBMISSION } from "./common";
import { isStringArray } from "./util";
import Sortable from "sortablejs";

export type ParsonsSpecification = {
  kind: "parsons";
  content: string;
  bank: {[index: string]: string};
  sample_solution?: Exclude<ParsonsSubmission, typeof BLANK_SUBMISSION>;
  default_grader?: QuestionGrader<"parsons", any>;
};

export type DropSubmission = {
  id: string,
  children: (string | DropSubmission)[]
}[];

export type ParsonsSubmission = (string | DropSubmission)[] | typeof BLANK_SUBMISSION;


function isValidParsonsSubmission(obj: any) : obj is Exclude<ParsonsSubmission, typeof BLANK_SUBMISSION> {
  return Array.isArray(obj) && obj.every(
    elem =>
      typeof elem === "string" ||
      Array.isArray(elem) && elem.every(d =>
        typeof d.id === "string" ||
        Array.isArray(d.children) && d.children.every((e: any) => typeof e === "string" || isValidParsonsSubmission(e))
      )
  )
}

function PARSONS_PARSER(rawSubmission: string | null | undefined) : ParsonsSubmission | typeof MALFORMED_SUBMISSION {
  if (rawSubmission === undefined || rawSubmission === null || rawSubmission.trim() === "") {
    return BLANK_SUBMISSION;
  }

  try {
    let parsed = JSON.parse(rawSubmission);
    if (isValidParsonsSubmission(parsed)) {
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

function PARSONS_RENDERER(response: ParsonsSpecification, question_uuid: string, skin?: QuestionSkin) {
  return createFilledParsons(applySkin(response.content, skin), response.bank, question_uuid);
}

function PARSONS_ACTIVATE(responseElem: JQuery) {
  responseElem.find(".examma-ray-fitb-drop-location").each(function() {
    let self = $(this);
    Sortable.create(this, {
      swapThreshold: 0.2,
      group: {
        name: `group-${self.data("examma-ray-drop-group-id")}`,
        put: () => {return self.closest("#bank").length === 0;},
        pull: () => { return true; }
      },
      removeOnSpill: true
    });
  });
}

function getFirstLevelParsonsElements(responseElem: JQuery<HTMLElement>) {
  return responseElem.find("input, textarea, .examma-ray-fitb-drop-location")
    .filter(function () {
      // Exclude elements that are nested inside an .examma-ray-fitb-drop-location element. Those
      // will be explored via the recursion below to properly populate the "children" array for a drop location.
      return $(this).parentsUntil(responseElem, ".examma-ray-fitb-drop-location").length === 0;
    })
    .get();
}

function extractHelper(responseElem: JQuery) : Exclude<ParsonsSubmission, typeof BLANK_SUBMISSION>{
  return getFirstLevelParsonsElements(responseElem).map(function(this: HTMLElement) : string | DropSubmission {
      let v: string | DropSubmission;
      if ($(this).hasClass("examma-ray-fitb-drop-location")) {
        // Cases where we're looking at the element for a drop location. We
        // find all direct children that are droppables, then map over them
        // to extract their id and any children they hold recursively.
        v = $(this).children(".examma-ray-fitb-droppable").get().map(function(this: HTMLElement) {
          return {
            id: "" + $(this).data("examma-ray-fitb-drop-id"),
            children: extractHelper($(this))
          };
        });
      }
      else {
        // Cases where we selected an input or textarea element. Extract its
        // value as a string.
        v = "" + ($(this).val() ?? "");
        v = v.trim() === "" ? "" : v;
      }
      return v;
    });
}

function PARSONS_EXTRACTOR(responseElem: JQuery) {
  let filledResponses = extractHelper(responseElem);
  return filledResponses.every(resp => resp === "" || Array.isArray(resp) && resp.length === 0) ? BLANK_SUBMISSION : filledResponses;
}

function cloneFromBank(dropBank: JQuery, id: string) {
  return dropBank.find(`[data-examma-ray-fitb-drop-id='${id}']`).clone();
}

function fillerHelper(elem: JQuery, submission: Exclude<ParsonsSubmission, typeof BLANK_SUBMISSION>, dropBank: JQuery) {

  let elems = getFirstLevelParsonsElements(elem);
  assert(elems.length === submission.length);
  submission.forEach((sub, i) => typeof sub === "string"
    ? $(elems[i]).val(sub) // just set value if it was a blank/box
    : sub.forEach(s => {
      // Fill in a clone of the element we recorded they had dropped in
      let droppedElem = cloneFromBank(dropBank, s.id);
      $(elems[i]).append(droppedElem);
      // TODO: does anything need to be activated for sortablejs on the dropped element? I think so
      
      // Recursively process any children on the dropped element/submission
      fillerHelper(droppedElem, s.children, dropBank);
    })
  );
}

function PARSONS_FILLER(responseElem: JQuery, submission: ParsonsSubmission) {

  if (submission === BLANK_SUBMISSION) {
    // blank out all the blanks/boxes
    responseElem.find("input, textarea").val("");
    
    // empty the drop locations
    responseElem.find(".examma-ray-fitb-drop-location").empty();

    return;
  }

  fillerHelper(responseElem, submission, responseElem.find(".examma-ray-fitb-drop-bank"));
}

export const PARSONS_HANDLER = {
  parse: PARSONS_PARSER,
  render: PARSONS_RENDERER,
  activate: PARSONS_ACTIVATE,
  extract: PARSONS_EXTRACTOR,
  fill: PARSONS_FILLER
};



/**
 * Matches anything that looks like e.g. ___BLANK___ or _____Blank_____.
 */
const BLANK_PATTERN = /_+ *blank *_+/gi;

/**
 * Matches anything that looks like e.g. [[BOX\n\n\n\n\n__________]] or [[Box\n\n]].
 * Those are real newlines, and at least 1 is required.
 */
const BOX_PATTERN = /\[\[[ _]*box[ _]*( *\n)+ *\]\]/gi;

/**
 * Matches anything that looks like e.g. [[DROP\n\n\n\n\n__________] or [[Drop\n\n]].
 * Those are real newlines, and at least 1 is required.
 */
const DROP_LOCATION_PATTERN = /\[\[[ _]*drop[ _]*( *\n)* *\]\]/gi;

/**
 * Matches anything that looks like e.g. _BANK_ or _____drop_bank_____.
 */
const BANK_PATTERN = /_+ *drop_bank *_+/gi;

function count_char(str: string, c: string) {
  let count = 0;
  for(let i = 0; i < str.length; ++i) {
    if (str[i] === c) { ++count; }
  }
  return count;
}

export function createFilledParsons(
  content: string,
  dropBank: {[index: string]: string},
  question_uuid: string,
  submission?: ParsonsSubmission,
  blankRenderer = DEFAULT_BLANK_RENDERER,
  boxRenderer = DEFAULT_BOX_RENDERER,
  dropLocationRenderer = DEFAULT_DROP_LOCATION_RENDERER,
  encoder: (s:string)=>string = encode) {

  // count the number of underscores in each blank pattern
  let blankLengths = content.match(BLANK_PATTERN)?.map(m => count_char(m, "_")) ?? [];

  // count the number of newlines and underscores in each box pattern (will be number of lines in textarea)
  let boxLines = content.match(BOX_PATTERN)?.map(m => 1+count_char(m, "\n")) ?? [];
  let boxWidths = content.match(BOX_PATTERN)?.map(m => count_char(m, "_")) ?? [];

  // count the number of newlines and underscores in each box pattern (will be max number of drops allowed in that box)
  let dropLocationLines = content.match(DROP_LOCATION_PATTERN)?.map(m => 1+count_char(m, "\n")) ?? [];
  let dropLocationWidths = content.match(DROP_LOCATION_PATTERN)?.map(m => count_char(m, "_")) ?? [];
  
  // Replace blanks/boxes with an arbitrary string that won't mess with
  // the way the markdown is rendered
  let blank_id = "laefiahslkefhalskdfjlksn";
  let box_id = "ewonfeoawihlawenfawhflaw";
  let drop_box_id = "ownerifweoinfahgknslflak";
  content = content.replace(BLANK_PATTERN, blank_id);
  content = content.replace(BOX_PATTERN, box_id);
  content = content.replace(DROP_LOCATION_PATTERN, drop_box_id);

  // Render markdown
  content = mk2html(content);

  // Include this in the html below so we can replace it in a moment
  // with the appropriate submission values
  let submission_placeholder = "awvblrefafhawonawflawlek";

  // Replace each of the "blank ids" in the rendered html with
  // a corresponding input element of the right size based on the
  // number of underscores that were originally in the "__BLANK__"
  blankLengths.forEach(length => {
    content = content.replace(blank_id, blankRenderer(submission_placeholder, length))
  });

  // Replace each of the "box ids" in the rendered html with
  // a corresponding textarea element with the right # of lines based on the
  // number of newlines that were originally in the "[[BOX\n\n\n]]"
  boxLines.forEach((lines, i) => {
    content = content.replace(box_id, boxRenderer(submission_placeholder, lines, boxWidths[i]));
  });

  dropLocationLines.forEach((lines, i) => {
    content = content.replace(drop_box_id, dropLocationRenderer(submission_placeholder, question_uuid, lines, dropLocationWidths[i]));
  });

  // Replace placeholders with submission values
  if (submission && submission !== BLANK_SUBMISSION) {
    submission.forEach(sub => content = content.replace(submission_placeholder,
      typeof sub === "string"
       ? encoder(sub)
       : sub.map(s => {
          assert(dropBank[s.id], `Cannot find drop item with ID ${s.id}.`);
          return createFilledParsons(dropBank[s.id], dropBank, question_uuid, s.children, blankRenderer, boxRenderer, dropLocationRenderer)
       }).join("")
      )
    );
  }

  // Replace any remaining placeholders that weren't filled (or all of them if there was no submission)
  content = content.replace(new RegExp(submission_placeholder, "g"), "");

  return content;
}

function DEFAULT_BLANK_RENDERER(submission_placeholder: string, length: number) {
  let autoAttrs = `autocomplete="off" autocorrect="off" spellcheck="false"`;
  return `<input type="text" value="${submission_placeholder}" size="${length}" maxlength="${length}" ${autoAttrs} class="examma-ray-fitb-blank-input nohighlight"></input>`;
}

function DEFAULT_BOX_RENDERER(submission_placeholder: string, lines: number, width: number) {
  let rcAttrs = `rows="${lines}"${width !== 0 ? ` cols="${width}"` : ""}`;
  let autoAttrs = `autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false"`;
  let style = `style="resize: none; overflow: auto;${width === 0 ? " width: 100%;" : ""}"`;
  return `<textarea ${rcAttrs} ${autoAttrs} class="examma-ray-fitb-box-input nohighlight" ${style}>${submission_placeholder}</textarea>`;
}

function DEFAULT_DROP_LOCATION_RENDERER(submission_placeholder: string, group_id: string, lines: number, width: number) {
  return `<span class="examma-ray-fitb-drop-location data-examma-ray-drop-group-id='${group_id}'">${submission_placeholder}</span>`;
}