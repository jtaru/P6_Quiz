const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const {models} = require("../models");

const paginate = require('../helpers/paginate').paginate;

// Autoload the quiz with id equals to :quizId
exports.load = (req, res, next, quizId) => {

    models.quiz.findById(quizId, {
        include: [
            //Modifique el controlador controllers/quiz.js para que al cargar de forma ansiosa (opción include)
            //las pistas en las búsquedas de quizzes, también se cargue quién es el autor de cada pista. Es
            //decir, en la llamada findById existente en el método load de controllers/quiz.js, hay que añadir
            //un include (anidado dentro del include existente) para models.tip que cargue los autores de los tips.
            {model: models.tip,
                include:  [{model: models.user, as: 'author'}]
            },
            {model: models.user, as: 'author'}
        ]
    })
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


// MW that allows actions only if the user logged in is admin or is the author of the quiz.
exports.adminOrAuthorRequired = (req, res, next) => {

    const isAdmin  = !!req.session.user.isAdmin;
    const isAuthor = req.quiz.authorId === req.session.user.id;

    if (isAdmin || isAuthor) {
        next();
    } else {
        console.log('Prohibited operation: The logged in user is not the author of the quiz, nor an administrator.');
        res.send(403);
    }
};


// GET /quizzes
exports.index = (req, res, next) => {

    let countOptions = {
        where: {}
    };

    let title = "Questions";

    // Search:
    const search = req.query.search || '';
    if (search) {
        const search_like = "%" + search.replace(/ +/g,"%") + "%";

        countOptions.where.question = { [Op.like]: search_like };
    }

    // If there exists "req.user", then only the quizzes of that user are shown
    if (req.user) {
        countOptions.where.authorId = req.user.id;
        title = "Questions of " + req.user.username;
    }

    models.quiz.count(countOptions)
    .then(count => {

        // Pagination:

        const items_per_page = 10;

        // The page to show is given in the query
        const pageno = parseInt(req.query.pageno) || 1;

        // Create a String with the HTMl used to render the pagination buttons.
        // This String is added to a local variable of res, which is used into the application layout file.
        res.locals.paginate_control = paginate(count, items_per_page, pageno, req.url);

        const findOptions = {
            ...countOptions,
            offset: items_per_page * (pageno - 1),
            limit: items_per_page,
            include: [{model: models.user, as: 'author'}]
        };

        return models.quiz.findAll(findOptions);
    })
    .then(quizzes => {
        res.render('quizzes/index.ejs', {
            quizzes, 
            search,
            title
        });
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

    const authorId = req.session.user && req.session.user.id || 0;

    const quiz = models.quiz.build({
        question,
        answer,
        authorId
    });

    // Saves only the fields question and answer into the DDBB
    quiz.save({fields: ["question", "answer", "authorId"]})
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
        res.redirect('/goback');
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
    //notEmptyQuizzes()
    models.quiz.findAll()
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
        score:req.session.score,
        result:result,
        answer:answer
    });
};