import { clearDownloads, downloadAnswersFile, unstickSectionHeadings, uploadAnswersFile } from "../common";
import expected from "./expected_download.json";

import chaiSubset from "chai-subset";
chai.use(chaiSubset);

function loadFreshPage() {

  const EXAM_URL = "full_test_exam/exams/test-test-full_test_exam.html";
  
  cy.clearLocalStorage();

  cy.visit(EXAM_URL);
  unstickSectionHeadings();

  cy.get("#exam-welcome-normal-modal button").click();

  cy.get("#exam-welcome-normal-modal button").should("not.be.visible");

}

function singleResponseElem() {
  return cy.get('.examma-ray-question-response.examma-ray-question-response-multiple_choice[data-response-kind="multiple_choice"]').eq(0);
}

function multipleResponseElem() {
  return cy.get('.examma-ray-question-response.examma-ray-question-response-multiple_choice[data-response-kind="multiple_choice"]').eq(1);
}

describe('MC Response', () => {

  const choices_text = ["Choice A", "Choice B", "Choice C", "Choice D", "Choice E"];
  
  beforeEach(() => {

    clearDownloads();
    loadFreshPage();

  });

  it('Response Element', () => {

    singleResponseElem().should("be.visible");
    multipleResponseElem().should("be.visible");

  });

  it('Render Single Choice Radio Inputs', () => {

    singleResponseElem().find('input[type=radio]').should("have.length", 5);
    singleResponseElem().find('input[type=radio]').each((jq, i) => {
      expect(jq.attr("id")).to.equal(`test-full_test_exam-q-test_question_mc_single_choice_${i}`);
      expect(jq.attr("name")).to.equal("test-full_test_exam-q-test_question_mc_single_choice");
      expect(jq.attr("value")).to.equal(`${i}`);
    });

  });

  it('Render Single Choice Labels', () => {
    singleResponseElem().find('label.examma-ray-mc-option').should("have.length", 5);
    singleResponseElem().find('label.examma-ray-mc-option').each((jq, i) => {
      expect(jq.attr("for")).to.equal(`test-full_test_exam-q-test_question_mc_single_choice_${i}`);
      expect(jq.html()).to.contain(choices_text[i]);
    });

  });

  it('Render Multiple Choice Radio Inputs', () => {

    multipleResponseElem().find('input[type=checkbox]').should("have.length", 5);
    multipleResponseElem().find('input[type=checkbox]').each((jq, i) => {
      expect(jq.attr("id")).to.equal(`test-full_test_exam-q-test_question_mc_multiple_choice_${i}`);
      expect(jq.attr("name")).to.equal("test-full_test_exam-q-test_question_mc_multiple_choice");
      expect(jq.attr("value")).to.equal(`${i}`);
    });
  });

  it('Render Multiple Choice Labels', () => {
    singleResponseElem().find('label.examma-ray-mc-option').should("have.length", 5);
    singleResponseElem().find('label.examma-ray-mc-option').each((jq, i) => {
      expect(jq.attr("for")).to.equal(`test-full_test_exam-q-test_question_mc_single_choice_${i}`);
      expect(jq.html()).to.contain(choices_text[i]);
    });

  });

  it('Select With Mouse (Single)', () => {

    singleResponseElem().find('input[type=radio]:checked')
      .should("have.length", 0);

    [0,1,2,3,4].forEach(i => {
      singleResponseElem().find('input[type=radio]').eq(i).click();
      singleResponseElem().find('input[type=radio]:checked').siblings("label")
        .should("have.length", 1)
        .should("contain", choices_text[i]);
    });

  });
  

  it('Select With Mouse via Label (Single)', () => {

    singleResponseElem().find('input[type=radio]:checked')
      .should("have.length", 0);

    [0,1,2,3,4].forEach(i => {
      singleResponseElem().find('label').eq(i).click();
      singleResponseElem().find('input[type=radio]:checked').siblings("label")
        .should("have.length", 1)
        .should("contain", choices_text[i]);
    });

  });

  it('Select With Mouse (Multiple)', () => {

    multipleResponseElem().find('input[type=checkbox]:checked')
      .should("have.length", 0);

    // click all
    let totalClicked = 0;
    [0,1,2,3,4].forEach(i => {
      multipleResponseElem().find('input[type=checkbox]').eq(i).click();
      multipleResponseElem().find('input[type=checkbox]:checked').siblings("label")
        .should("have.length", ++totalClicked)
        .should("contain", choices_text[i]);
    });

    // unclick all
    [4, 3, 2, 1].forEach(i => {
      multipleResponseElem().find('input[type=checkbox]').eq(i).click();
      multipleResponseElem().find('input[type=checkbox]:checked').siblings("label")
        .should("have.length", --totalClicked)
        .should("not.contain", choices_text[i]);
    });

    // uncheck last one
    multipleResponseElem().find('input[type=checkbox]').eq(0).click();
    multipleResponseElem().find('input[type=checkbox]:checked').should("not.exist");

  });
  

  it('Select With Mouse via Label (Multiple)', () => {

    multipleResponseElem().find('input[type=checkbox]:checked')
      .should("have.length", 0);

    // click all
    let totalClicked = 0;
    [0,1,2,3,4].forEach(i => {
      multipleResponseElem().find('label').eq(i).click();
      multipleResponseElem().find('input[type=checkbox]:checked').siblings("label")
        .should("have.length", ++totalClicked)
        .contains(choices_text[i]);
    });

    // unclick all but last
    [4, 3, 2, 1].forEach(i => {
      multipleResponseElem().find('label').eq(i).click();
      multipleResponseElem().find('input[type=checkbox]:checked').siblings("label")
        .should("have.length", --totalClicked)
        .should("not.contain", choices_text[i]);
    });

    // uncheck last one
    multipleResponseElem().find('label').eq(0).click();
    multipleResponseElem().find('input[type=checkbox]:checked').should("not.exist");

  });

  
  // it('Respect Maxlength on Blanks', () => {

  //   responseElem().find('.examma-ray-fitb-blank-input').eq(2).type("123456");
  //   responseElem().find('.examma-ray-fitb-blank-input').eq(2).should("have.value", "starter-blank123");
    
  // });

  // it('Modify Boxes', () => {

  //   responseElem().find('.examma-ray-fitb-box-input').first().type("!");
  //   responseElem().find('.examma-ray-fitb-box-input').first().should("have.value", "starter\nbox!");

  //   responseElem().find('.examma-ray-fitb-box-input').first().clear().type("new text");
  //   responseElem().find('.examma-ray-fitb-box-input').first().should("have.value", "new text");
    
  // });

  // it("Restores From Local Storage", () => {

  //   // Make a change so that autosave will modify local storage

  //   responseElem().find('.examma-ray-fitb-box-input').first().type("!");

  //   // Wait for autosave
  //   cy.wait(7000);
  //   cy.getLocalStorage("full_test_exam-test-test-full_test_exam").should("not.be.null");

  //   // Compare current state of response element to state after page reload
  //   responseElem().then((original) => {
  //     cy.reload();
  //     unstickSectionHeadings();
      
  //     cy.get("#exam-welcome-restored-modal button").click();
  //     cy.get("#exam-welcome-restored-modal button").should("not.be.visible");
  
  //     cy.getLocalStorage("full_test_exam-test-test-full_test_exam").should("not.be.null");
      
  //     responseElem().should((restored) => restored.html().trim() === original.html().trim());
  //   })
    
  // });

  // it("Downloads to Answers File", () => {

  //   let filepath = downloadAnswersFile("test-answers.json");

  //   cy.readFile(filepath, { timeout: 10000 }).should(json => {
  //     expect(json).to.containSubset(expected);
  //   });
    
  // });

  // it("Download + Restore from Answers File", () => {

  //   // Make a change to the answer - edit input blank
  //   responseElem().find('.examma-ray-fitb-blank-input').eq(2).type("!");

  //   // Make a change to the answer - drag/drop
  //   responseElem().find('.examma-ray-fitb-drop-bank [data-examma-ray-fitb-drop-id="item2"]').trigger("pointerdown", {button: 0});
  //   responseElem().find('.sortable-chosen').trigger("dragstart");
  //   cy.wait(100);
  //   responseElem().find('.examma-ray-fitb-drop-location').last().trigger("dragenter");
  //   responseElem().find('.sortable-chosen.sortable-ghost > *').first().trigger("drop");
  //   responseElem().find('.examma-ray-fitb-drop-location').last().contains("item-test-2");
    
  //   // Compare current state of response element to state after clearing local storage, reloading page, uploading exam.
  //   responseElem().then((original) => {
      
  //     const filename = "test-answers.json";
  //     const filepath = downloadAnswersFile(filename);

  //     loadFreshPage();
  
  //     // sanity check no local storage
  //     cy.getLocalStorage("full_test_exam-test-test-full_test_exam").should("be.null");

  //     cy.readFile(filepath, { timeout: 10000 }).then(json => {

  //       uploadAnswersFile({
  //         fileName: filename,
  //         fileContent: json,
  //         encoding: "utf8",
  //       });

  //       responseElem().should((restored) => restored.html().trim() === original.html().trim());
  //     });

  //   });
    
  // });

})