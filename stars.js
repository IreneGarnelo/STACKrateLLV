// Copyright 2022 by Jonas Lache <jonas.lache@ruhr-uni-bochum.de>
// Copyright 2022 by Daniel Meißner <daniel.meissner-i4k@ruhr-uni-bochum.de>
// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";
(function() {

const stackrateUrl = (function() {

    const packageRoot = document.currentScript.src.replace("/stars.js", "");

    return function(path) {
        /* String -> String
         *
         * Return the absolute URL to PATH, a path relative to the STACKrate
         * root. */

        if (path.charAt(0) == "/") {
            return packageRoot + path;
        } else {
            return packageRoot + "/" + path;
        }
    };
})();

async function makeTranslator(language) {
    /* String -> [String -> String]
     *
     * Make a translator for LANGUAGE.  A translator is a function
     * that takes a message and returns its translation. */

    const url = stackrateUrl("/translations/" + language + ".json");
    let dictionary = await fetch(url).then(response => {
        if (response.ok) {
            return response.json();
        } else {
            console.warn("stackrate: Unable to fetch `"
                         + language + "' translations.");
            return {};
        }
    });

    function translate(message) {
        if (message in dictionary) {
            return dictionary[message];
        } else {
            return message;
        }
    }

    return translate;
}

function parseLangTag(str) {
    const re = /^[a-z]{2}/;
    return str.match(re)[0];
}

class RatingForm {

    constructor(field, stackQuestion) {
        this.field = field;
        this.stackQuestion = stackQuestion;
        this.questions = field.querySelectorAll(".question");
        this.errorElement = document.createElement("p");
        this.errorElement.classList.add("error");

        if (!this.questions) {
            throw Error("stars: no questions found.");
        }

        const documentLangTag = document.querySelector("html").lang;
        const fieldLangTag = field.getAttribute("lang");
        const langTag = (fieldLangTag == null) ?
              documentLangTag : fieldLangTag;

        this.hackMoodle =
            field.getAttribute("data-moodle-integration") == "false" ?
            false : true;

        makeTranslator(parseLangTag(langTag)).then(translate => {
            this.translate = translate;
            this.surveyData = this.loadState();
            this.initialize();
            this.saveRating();
        });
    }

    initialize() {
        if (this.surveyData.submitted) {
            const successMessage = document.createElement("p");
            successMessage.innerText = this.translate("Thanks for your rating!");
            successMessage.classList.add("success");
            this.field.replaceChildren(successMessage);
        } else {

            this.questions.forEach((question, questionIndex) => {
                const starspan = question.querySelector(".stars");
                const stars = [];
                for (let i = 0; i < 5; ++i) {
                    stars[i] = document.createElement("span");
                    stars[i].innerText = "☆";
                    stars[i].addEventListener("mouseover", event => {
                        let element = event.target;
                        while (element) {
                            this.highlight(element);
                            element = element.previousElementSibling;
                        }
                    });
                    stars[i].addEventListener("mouseout", event => {
                        this.update();
                    });
                    stars[i].addEventListener("click", event => {
                        const ratings = this.surveyData.ratings;

                        /* Rate or unrate */
                        if (ratings[questionIndex] == i + 1) {
                            ratings[questionIndex] = 0;
                        } else {
                            ratings[questionIndex] = i + 1;
                        }
                        this.saveRating();
                        this.update();

                        if (this.receivedRatings()
                           && this.hackMoodle) {
                            this.renameMoodleSubmit();
                        }
                    });
                    if (starspan) {
                        starspan.append(stars[i]);
                    }
                }
            });

            const legend = document.createElement("p");
            legend.innerText = this.translate("(1 star = worst rating, …, 5 stars = best rating)");
            this.field.append(legend);

            if (this.field.classList.contains("with-comment")) {
                this.field.append(this.generateCommentBox());
            }
            this.field.append(this.errorElement);
        }
    }

    renameMoodleSubmit() {
        const button = this.stackQuestion.querySelector('input[type="submit"]');
        if (button) {
            button.value = this.translate("Submit rating");
        } else {
            console.warn("STACKrate: no check button in quiz");
        }
    }
    receivedRatings() {
        return (this.field.offsetParent == null
                || this.surveyData.ratings.filter(
                    x => x == 0).length == 0);
    }

    showError(msg) {
        this.errorElement.innerText = this.translate(msg);
    }

    generateCommentBox() {
        const commentBox = document.createElement("div");
        commentBox.append(
            this.translate("Feel free to share with us more details below."));

        const textarea = document.createElement("textarea");
        textarea.setAttribute("rows", "3");
        textarea.setAttribute("maxlength", "500");
        textarea.addEventListener("input", event => {
            this.surveyData.comment = textarea.value;
            this.saveRating();
        });
        textarea.style.display = "block";
        commentBox.append(textarea);
        commentBox.classList.add("comment-box");
        return commentBox;
    }

    /* highlight the star in ELEMENT */
    highlight(element) {
        element.innerText = "★";
        element.style.color = "orange";
    }

    /* de-highlight the star in ELEMENT */
    dehighlight(element) {
        element.innerText = "☆";
        element.style.color = "black";
    }

    /* Update the view according to current ratings */
    update() {
        this.questions.forEach((que, ind) => {
            const stars = que.querySelectorAll(".stars > span");

            for (let i = 0; i < stars.length; ++i) {
                if (i < this.surveyData.ratings[ind]) {
                    this.highlight(stars[i]);
                } else {
                    this.dehighlight(stars[i]);
                }
            }
        });
    }

    /* Store the ratings in JSON format */
    saveRating() {
        const input =
            this.stackQuestion.querySelector(".ratingResults > input");

        let savedData = null;
        try {
            savedData = JSON.parse(input.value);
        } catch (e) {
            savedData = {};
        }
        savedData[this.fieldKey()] = this.surveyData;
        input.value = JSON.stringify(savedData);
        return JSON.stringify(savedData);
    }

    saveState() {
        sessionStorage.setItem(this.sessionStorageKey(),
                                      this.saveRating());
    }

    loadState() {
        let surveyData = {};

        try {
            const states = JSON.parse(
                sessionStorage.getItem(
                    this.sessionStorageKey()));
            surveyData = states[this.fieldKey()];
        } catch (e) {
            surveyData = {
                /* no ratings given */
                ratings: Array(this.questions.length).fill(0),
                /* no comment given */
                comment: "",
                submitted: false
            };
        }

        if (!surveyData) {
            surveyData = {
                /* no ratings given */
                ratings: Array(this.questions.length).fill(0),
                /* no comment given */
                comment: "",
                submitted: false
            };
        }

        return surveyData;
    }

    sessionStorageKey() {
        return this.stackQuestion.id + "_ratings";
    }

    fieldKey() {
        return this.field.getAttribute("data-name");
    }

}

function installCss() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = stackrateUrl("/stars.css");
    document.head.append(link);
}

function installRatingForms() {
    let ratingFields = [];
    document.querySelectorAll(".que.stack").forEach(question => {
        let queRatingFields = [];
        question.querySelectorAll(".stars-rating").forEach(field => {
            // TODO: Fix this duplicate rating fields list construction
            const ratForm = new RatingForm(field, question);
            queRatingFields.push(ratForm);
            ratingFields.push(ratForm);
        });

        // Hack question submit button
        const button = question.querySelector('input[type="submit"]');

        if (!button) {
            console.warn("STACKrate: no check button in quiz");
            return;
        }

        button.addEventListener("click", event => {
            if (queRatingFields.every(field => field.receivedRatings())) {
                // set submitted for filled ratings
                queRatingFields.forEach(field => {
                    const surveyData = field.surveyData;
                    if (surveyData.ratings.filter(x => x == 0).length == 0) {
                        surveyData.submitted = true;
                        field.saveState();
                    }
                });
            } else {
                // event.preventDefault();
                // event.stopImmediatePropagation();

                queRatingFields.forEach(field => {
                    if (!field.receivedRatings()) {
                        // field.showError("Please submit all ratings!");
                    }
                });
            }
        });
    });

    // TODO: Fix code duplication
    const nextBtn = document.querySelector('input[name="next"]');

    if (!nextBtn) {
        console.warn("STACKrate: no next button in quiz");
        return;
    }

    nextBtn.addEventListener("click", event => {
        if (ratingFields.every(field => field.receivedRatings())) {
            // set submitted for filled ratings
            ratingFields.forEach(field => {
                const surveyData = field.surveyData;
                if (surveyData.ratings.filter(x => x == 0).length == 0) {
                    surveyData.submitted = true;
                    field.saveState();
                }
            });
        } else {
            // event.preventDefault();
            // event.stopImmediatePropagation();

            ratingFields.forEach(field => {
                if (!field.receivedRatings()) {
                    // field.showError("Please submit all ratings!");
                }
            });
        }
    });
}

function install() {
    installCss();
    installRatingForms();
}

if (window.RatingForm === undefined) {
    window.RatingForm = RatingForm;

    document.addEventListener("DOMContentLoaded", install);
}
})();
