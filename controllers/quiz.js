const Sequelize = require("sequelize");
const {models} = require("../models");

// Autoload the quiz with id equals to :quizId
exports.load = (req, res, next, quizId) => {

    models.quiz.findById(quizId)
    .then(quiz => {
        if (quiz) {
            req.quiz = quiz;
            next();
        } else {
            throw new Error('There is no quiz with id=' + quizId);
        }
    })
    .catch(error => next(error));
};


// GET /quizzes
exports.index = (req, res, next) => {

    models.quiz.findAll()
    .then(quizzes => {
        res.render('quizzes/index.ejs', {quizzes});
    })
    .catch(error => next(error));
};


// GET /quizzes/:quizId
exports.show = (req, res, next) => {

    const {quiz} = req;

    res.render('quizzes/show', {quiz});
};


// GET /quizzes/new
exports.new = (req, res, next) => {

    const quiz = {
        question: "", 
        answer: ""
    };

    res.render('quizzes/new', {quiz});
};

// POST /quizzes/create
exports.create = (req, res, next) => {

    const {question, answer} = req.body;

    const quiz = models.quiz.build({
        question,
        answer
    });

    // Saves only the fields question and answer into the DDBB
    quiz.save({fields: ["question", "answer"]})
    .then(quiz => {
        req.flash('success', 'Quiz created successfully.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, error => {
        req.flash('error', 'There are errors in the form:');
        error.errors.forEach(({message}) => req.flash('error', message));
        res.render('quizzes/new', {quiz});
    })
    .catch(error => {
        req.flash('error', 'Error creating a new Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/edit
exports.edit = (req, res, next) => {

    const {quiz} = req;

    res.render('quizzes/edit', {quiz});
};


// PUT /quizzes/:quizId
exports.update = (req, res, next) => {

    const {quiz, body} = req;

    quiz.question = body.question;
    quiz.answer = body.answer;

    quiz.save({fields: ["question", "answer"]})
    .then(quiz => {
        req.flash('success', 'Quiz edited successfully.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, error => {
        req.flash('error', 'There are errors in the form:');
        error.errors.forEach(({message}) => req.flash('error', message));
        res.render('quizzes/edit', {quiz});
    })
    .catch(error => {
        req.flash('error', 'Error editing the Quiz: ' + error.message);
        next(error);
    });
};


// DELETE /quizzes/:quizId
exports.destroy = (req, res, next) => {

    req.quiz.destroy()
    .then(() => {
        req.flash('success', 'Quiz deleted successfully.');
        res.redirect('/quizzes');
    })
    .catch(error => {
        req.flash('error', 'Error deleting the Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/play
exports.play = (req, res, next) => {

    const {quiz, query} = req;

    const answer = query.answer || '';

    res.render('quizzes/play', {
        quiz,
        answer
    });
};


// GET /quizzes/:quizId/check
exports.check = (req, res, next) => {

    const {quiz, query} = req;

    const answer = query.answer || "";
    const result = answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim();

    res.render('quizzes/result', {
        quiz,
        result,
        answer
    });
};

exports.randomplay = (req, res, next) => {
    var indicesArray = req.session.randomPlay || [];
    var score = req.session.score || 0;
    const {quiz, query} = req;
    notEmptyQuizzes()
    .then(quizzes =>{
        //Si es la primera vez que se juega
        if (indicesArray.length === 0) {
            for (var i = 0; i < quizzes.length; i++) {
                indicesArray.push(quizzes[i]);
            }
        }
        //Busco id aleatorio dentro de los indices de las preguntas no respondidas
        let id = Math.floor(Math.random()*indicesArray.length);
        let quiz = quizzes[id];

        //score = quizzes.length - indicesArray.length;

        //Borro la celda del indice a resolver en la siguiente pregunta
        indicesArray.splice(id, 1);
        req.session.randomPlay = indicesArray;

        if(req.session.score==quizzes.length){
            res.render('quizzes/random_nomore', {
                score: req.session.score
            });
            req.session.score = 0;
            req.session.randomplay = [];
        }else{
            res.render('quizzes/random_play',{
                quiz: quiz,
                score: req.session.score
            });

        }
    })
    .catch(error => next(error));
};
const notEmptyQuizzes = () => {
    return new Sequelize.Promise((resolve, reject) => {
        models.quiz.findAll()
            .then(quizzes => {
                if (quizzes.length > 0) {
                    resolve(quizzes);
                }
                else {
                    reject(new Error("No quizzes"));
                }
            })
    });
};

exports.randomcheck = function (req, res, next) {

    var answer = req.query.answer || "";
    var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();

    let score;

    if(result){
        //Jugador acierta
        req.session.score++;
        score = req.session.score;
    }else {
        score=req.session.score;
        req.session.score=0;
    }

    res.render('quizzes/random_result', {
        score:score,
        result:result,
        answer:answer
    });
};