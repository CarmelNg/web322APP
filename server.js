/********************************************************************************
*  WEB322 – Assignment 06
*  I declare that this assignment is my own work in accordance with Seneca  Academic Policy.  No part *  of this assignment has been copied manually or electronically from any other source 
*  (including 3rd party web sites) or distributed to other students.
* 
*  Name: _Carmel Cheumadjeu Nguelebek__ Student ID: _130451214_ Date: _12/12//2022____
*
*  Online Link: hhttps://smoggy-uniform-deer.cyclic.app
*
********************************************************************************/

var express = require("express");
const { sendFile } = require("express/lib/response");
var path = require("path");
var blog = require("./blog-service.js");
const multer = require("multer");
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const exphbs = require("express-handlebars");
const stripJs = require('strip-js');
const authData = require('./web322-app/auth-service');
const clientSessions = require('client-sessions');

var app = express();

var HTTP_PORT = process.env.PORT || 8080;

cloudinary.config({
    cloud_name: 'carmelapp',
    api_key: '113571496754721',
    api_secret: 'VBMlLHnNTAtRsDbaNZ__ehaORR0',
    secure: true
});
const upload = multer(); 

app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    helpers: {
        navLink: function(url, options){
            return '<li' +
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function(lvalue, rvalue, options){
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        },
        safeHTML: function(context){
            return stripJs(context);
        },
        formatDate: function(dateObj){
            let year = dateObj.getFullYear();
            let month = (dateObj.getMonth() + 1).toString();
            let day = dateObj.getDate().toString();
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2,'0')}`;
        }
    }
}));
app.set("view engine", ".hbs");

app.use(express.static('public'));

app.use(express.urlencoded({extended: true}));

app.use(function (req, res, next) {
    let route = req.path.substring(1);
    app.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));
    app.locals.viewingCategory = req.query.category;
    next();
});

app.use(clientSessions({
    cookieName: "session", 
    secret: "web322-carmel_secret", 
    duration: 2 * 60 * 1000, 
    activeDuration: 1000 * 60 
}));

app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});
  
function ensureLogin(req, res, next) {
    if (!req.session.user) {
      res.redirect("/login");
    } else {
      next();
    }
}

app.get("/", (req, res) => {
    res.redirect("/blog");
});

app.get("/about", (req, res) => {
    res.render("about");
});

app.get('/blog', async (req, res) => {

    let viewData = {};

    try{

        let posts = [];

        if(req.query.category){
            posts = await blog.getPublishedPostsByCategory(req.query.category);
        }else{
            posts = await blog.getPublishedPosts();
        }

        posts.sort((a,b) => new Date(b.postDate) - new Date(a.postDate));
        let post = posts[0]; 

        viewData.posts = posts;
        viewData.post = post;

    }catch(err){
        viewData.message = "no results";
    }

    try{
        let categories = await blog.getCategories();
        viewData.categories = categories;
    }catch(err){
        viewData.categoriesMessage = "no results"
    }

    res.render("blog", {data: viewData})

});

app.get('/blog/:id', async (req, res) => {

    let viewData = {};

    try{

        let posts = [];

        if(req.query.category){
            posts = await blog.getPublishedPostsByCategory(req.query.category);
        }else{
            posts = await blog.getPublishedPosts();
        }

        posts.sort((a,b) => new Date(b.postDate) - new Date(a.postDate));

        viewData.posts = posts;

    }catch(err){
        viewData.message = "no results";
    }

    try{
        viewData.post = await blog.getPostById(req.params.id);
    }catch(err){
        viewData.message = "no results"; 
    }

    try{
        let categories = await blog.getCategories();

        viewData.categories = categories;
    }catch(err){
        viewData.categoriesMessage = "no results"
    }

 
    res.render("blog", {data: viewData})
});

app.get('/posts', ensureLogin, (req, res) => {

    let queryPromise = null;

    if (req.query.category) {
        queryPromise = blog.getPostsByCategory(req.query.category);
    } else if (req.query.minDate) {
        queryPromise = blog.getPostsByMinDate(req.query.minDate);
    } else {
        queryPromise = blog.getAllPosts();
    }

    queryPromise.then(data => {
        (data.length > 0) ? res.render("posts", {posts: data}) : res.render("posts",{ message: "no results" });
    }).catch(err => {
        res.render("posts", {message: "no results"});
    })

});

app.post("/posts/add", ensureLogin, upload.single("featureImage"), (req,res)=>{

    if(req.file){
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );
    
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };
    
        async function upload(req) {
            let result = await streamUpload(req);
            console.log(result);
            return result;
        }
    
        upload(req).then((uploaded)=>{
            processPost(uploaded.url);
        });
    }else{
        processPost("");
    }

    function processPost(imageUrl){
        req.body.featureImage = imageUrl;

        blog.addPost(req.body).then(post=>{
            res.redirect("/posts");
        }).catch(err=>{
            res.status(500).send(err);
        })
    }   
});

app.get('/posts/add', ensureLogin, (req, res) => {
    blog.getCategories().then((data)=>{
        res.render("addPost", {categories: data});
     }).catch((err) => {
       // set category list to empty array
       res.render("addPost", {categories: [] });
    });
});

app.get("/posts/delete/:id", ensureLogin, (req,res)=>{
    blog.deletePostById(req.params.id).then(()=>{
      res.redirect("/posts");
    }).catch((err)=>{
      res.status(500).send("Unable to Remove Post / Post Not Found");
    });
});

app.get('/post/:id', ensureLogin, (req,res)=>{
    blog.getPostById(req.params.id).then(data=>{        
        res.json(data);
    }).catch(err=>{
        res.json({message: err});
    });
});

app.get('/categories', ensureLogin, (req, res) => {
    blog.getCategories().then((data => {
        (data.length > 0) ? res.render("categories", {categories: data}) : res.render("categories",{ message: "no results" });
    })).catch(err => {
        res.render("categories", {message: "no results"});
    });
});

app.get('/categories/add', ensureLogin, (req, res) => {
    res.render("addCategory");
});

app.post('/categories/add', ensureLogin, (req,res)=>{
    blog.addCategory(req.body).then(category=>{
        res.redirect("/categories");
    }).catch(err=>{
        res.status(500).send(err.message);
    })
});

app.get("/categories/delete/:id", ensureLogin, (req,res)=>{
    blog.deleteCategoryById(req.params.id).then(()=>{
      res.redirect("/categories");
    }).catch((err)=>{
      res.status(500).send("Unable to Remove Category / Category Not Found");
    });
});

app.get("/login", (req,res)=>{
    res.render("login");
});

app.get("/register", (req,res)=>{
    res.render("register");
});

app.post("/register", (req,res)=>{
    authData.registerUser(req.body).then(
        res.render("register", 
        {successMessage: "User created"})
    ).catch((err) => {  
        res.render("register", {errorMessage: err, userName: req.body.userName})
    });
});

app.post("/login", (req,res)=>{
    req.body.userAgent = req.get('User-Agent');

    authData.checkUser(req.body).then((user) => {
        req.session.user = {
            userName: user.userName,
            email: user.email,
            loginHistory: user.loginHistory
        }
    
        res.redirect('/posts');
    }).catch((err) => {
        res.render("login",    
        {errorMessage: err, userName: req.body.userName})
    })
});

app.get("/logout", (req,res)=>{
    req.session.reset();
    res.redirect("/login");
});


app.get("/userHistory", ensureLogin, (req,res)=>{
    res.render("userHistory");     
});


app.use((req, res) => {
    res.status(404).render("404");
});

blog.initialize()
.then(authData.initialize)        
.then(function(){
    app.listen(HTTP_PORT, function(){
        console.log("app listening on: " + HTTP_PORT)
    });
}).catch(function(err){
    console.log("unable to start server: " + err);
});


