const Sequelize = require("sequelize");
const {models} = require("../models");


// Autoload the tip with id equals to :tipId
exports.load = (req, res, next, tipId) => {

    models.tip.findById(tipId)
    .then(tip => {
        if (tip) {
            req.tip = tip;
            next();
        } else {
            next(new Error('There is no tip with tipId=' + tipId));
        }
    })
    .catch(error => next(error));
};


// POST /quizzes/:quizId/tips
exports.create = (req, res, next) => {
    //El nuevo modelo tip necesita tener la clave externa llamada authorId para implementar la relación
    //anterior. Cree una migración que añada el campo authorId a la tabla tips. Esta migración es
    //similar a la creada en el tema 17 para añadir el campo authorId a la tabla quizzes.
    
    const authorId = req.session.user && req.session.user.id || 0;
 
    const tip = models.tip.build(
        {
            text: req.body.text,
            quizId: req.quiz.id,

            //Cree una migración que añada el campo authorId a la tabla tips.
            authorId: authorId
        });

    tip.save()
    .then(tip => {
        req.flash('success', 'Tip created successfully.');
        res.redirect("back");
    })
    .catch(Sequelize.ValidationError, error => {
        req.flash('error', 'There are errors in the form:');
        error.errors.forEach(({message}) => req.flash('error', message));
        res.redirect("back");
    })
    .catch(error => {
        req.flash('error', 'Error creating the new tip: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/tips/:tipId/accept
exports.accept = (req, res, next) => {

    const {tip} = req;

    tip.accepted = true;

    tip.save(["accepted"])
    .then(tip => {
        req.flash('success', 'Tip accepted successfully.');
        res.redirect('/quizzes/' + req.params.quizId);
    })
    .catch(error => {
        req.flash('error', 'Error accepting the tip: ' + error.message);
        next(error);
    });
};


// DELETE /quizzes/:quizId/tips/:tipId
exports.destroy = (req, res, next) => {

    req.tip.destroy()
    .then(() => {
        req.flash('success', 'tip deleted successfully.');
        res.redirect('/quizzes/' + req.params.quizId);
    })
    .catch(error => next(error));
};

//comprueba que el usuario logueado es el autor de la pista o es un usuario administrador
exports.adminOrAuthorRequired = (req, res, next) => {
     
    const isAdmin  = !!req.session.user.isAdmin;
    const isAuthorTip = req.tip.authorId === req.session.user.id;

    if (isAdmin || isAuthorTip) {
        next();
    } else {
        console.log('Prohibited operation: The logged in user is not the author of the quiz, nor an administrator.');
        res.send(403);
    }
};

//Añada en controllers/tip.js los middlewares que atienden las dos peticiones anteriores. Llamelos edit y update.

// GET /quizzes/:quizId/:tipId/edit
exports.edit = (req, res, next) => {

    const {tip,quiz} = req;

    res.render('tips/edit', {tip,quiz});
};

// PUT /quizzes/:quizId
exports.update = (req, res, next) => {

    const {quiz, tip,body} = req;

    tip.text = body.text;
    tip.accepted = false;
    tip.save({fields: ["text","accepted"]})
    .then(tip => {
        req.flash('success', 'Tip edited successfully.');
        res.redirect('/goback' );
    })
    .catch(Sequelize.ValidationError, error => {
        req.flash('error', 'There are errors in the form:');
        error.errors.forEach(({message}) => req.flash('error', message));
        res.render('tips/edit', {tip});
    })
    .catch(error => {
        req.flash('error', 'Error editing the Tip: ' + error.message);
        next(error);
    });
};