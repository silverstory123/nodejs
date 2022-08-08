const express = require('express');
const app = express();
app.listen(3000);
const bodyParser = require('body-parser');
const hls = require('hls-server');
const fs = require('fs');
//session
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const { DiffieHellmanGroup } = require('crypto');
var FileStore = require('session-file-store')(session);

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');


//dynamoDB 연결
const AWS = require('aws-sdk');
const config = require('./config/config.js');
AWS.config.update(config.aws_remote_config);
const docClient = new AWS.DynamoDB.DocumentClient();

//session-middleware 웹서버는 요청 - 응답해주는 머신 요청-응답 중간에 뭔가 실행되는 코드
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/public', express.static('public')); // public 미들웨어 서버사용
app.use(session({
    secret: '비밀코드',
    resave: true,
    saveUninitialized: false,
    //store: new FileStore
}));
app.set('view engine', 'ejs');
app.use(passport.initialize());
app.use(passport.session());


//video_upload 비디오 업로드
// let multer = require('multer');
// let path = require('path');
// const { DynamoDB } = require('aws-sdk');
// const { request } = require('http');

// var _storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         const directory = fs.existsSync('./public/' + req.session.passport.user + '/' + req.body.text);
//         console.log('Boolean : ', directory);
//         if (!directory) {
//             fs.mkdirSync('./public/' + req.session.passport.user + '/' + req.body.text, { recursive: true }); //adflnwltkwnql
//             cb(null, './public/' + req.session.passport.user + '/' + req.body.text);
//         } else {
//             console.log('예기치 못한 상황이 발생하여 폴더를 생성할 수 없습니다');
//         }
//     },
//     filename: function (req, file, cb) {
//         let extension = path.extname(file.originalname);
//         let basename = path.basename(file.originalname, extension);
//         cb(null, basename + extension);
//     }
// });
// var upload = multer({ storage: _storage });



//로그인 세션 유/무 확인
function login_check(req, res, next) {
    if (req.user) {
        next()
    } else {
        res.send('로그인 노노')
    }
}

//main
app.get('/', function (req, res) {
    const scan = {
        TableName: 'loveless_table',
    }
    docClient.scan(scan, (err, data) => {
        res.render('index.ejs', { post: data.Items, session: req.session.passport });
    })
})

app.get('/upload', login_check, (req, res) => {
    res.render('upload.ejs', { session_id: req.session.passport.user });
});


//video_stream 비디오 스트리밍
app.get('/stream/:video_name', (req, res) => {
    const query = {
        TableName: 'loveless_table',
        KeyConditionExpression: 'video_name = :i',
        ExpressionAttributeValues: {
            ':i': req.params.video_name
        }
    }
    docClient.query(query, (err, data) => {
        if (!err)
            res.status(200).render('stream.ejs', { loveless_video: data.Items, session: req.session.passport });
    })

})

//User Join 
app.get('/join', (req, res) => {
    res.render('user_join.ejs');
})

//user_login 유저 로그인
app.get('/login', (req, res) => {
    res.render('user_login.ejs')
});

app.get('/logout', (req,res) => {
    req.session.destroy();
    res.redirect('/');
})

//user_modify 유저 정보 수정 및 삭제
app.get('/modify', (요청, 응답) => {
    응답.render('user_modify.ejs');
})

//user_mypage(video list page) 유저 마이페이지(비디오 영상 조회)
app.get('/mypage',login_check, (요청, 응답) => {
    응답.render('user_mypage.ejs');
})


//실패시 보여주는 메세지.
app.get('/fail', (req, res) => {
    res.send('fail');
})


// app.post('/upload', upload.single('file'), function (req, res) {
//     console.log(req.session.passport.user);
//     const scan = {
//         TableName: 'loveless_table',
//         // KeyConditionExpression: 'user_id = :i',
//         // ExpressionAttributeValues: {
//         //     ':i' : 'test'
//         // }
//     }
//     docClient.scan(scan,(err,data) => {
//         console.log(data.Count);
//         let today = Date.now();
//     const put = {
//         TableName: 'loveless_table',
//         Item : { 
//             'video_name': req.body.text, 'user_id': req.session.passport.user,
//             'video_path': req.file.destination.split('.').pop(),
//             'video_UploadDate': today, 'video_count': data.Count + 1,
//         }
//     }
//     docClient.put(put).promise().then( request => {
//         //console.log(put.Item.user_id);
//         ffmpeg.setFfmpegPath(ffmpegInstaller.path);
//         ffmpeg(req.file.path, { timeout: 432000 }).addOptions([
//             '-profile:v baseline',
//             '-level 3.0',
//             '-start_number 0',
//             '-hls_time 10',
//             '-hls_list_size 0',
//             '-f hls'
//         ]).output(req.file.destination + '/index.m3u8').on('end', function () {
//             const filePath = path.join(__dirname, req.file.destination, req.file.filename);
//             fs.unlink(filePath, function(err2){
//                 if(err2){
//                     console.log("Error : ", err2);
//                 }
//             })
//             res.send('업로드완료')
//         }).run();
//     }).catch(err => {
//         console.log(err);
//     })
//     })
// });



//Join 
app.post('/join', (req, res) => {
    //ID,PW,birth,email.phon,createDate,LastSessionDate store dynamoDB
    let today = new Date(); let year = today.getFullYear(); let month = today.getMonth() + 1; let date = today.getDate();
    const put = {
        TableName: 'login_loveless',
        Item: {
            'user_id': req.body.user_id, 'user_pw': req.body.user_pw,
            'user_birth': req.body.user_birth, 'user_email': req.body.user_email,
            'user_phone': req.body.user_phone, 'user_createDate': year + '/' + month + '/' + date,
            'user_lastSessionDate': year + '/' + month + '/' + date, 'idnumber': 1
        }
    }
    docClient.put(put).promise().then(req => {
        res.redirect('/');
    }).catch(err => {
        console.log(err);
    })
})

//user_login 요청
app.post('/login', passport.authenticate('local', {
    failureRedirect: "/fail"
}), (req, res) => { //passport.authenticate id,pw 인증
    //success
    res.redirect('/');
});

passport.use(new LocalStrategy({
    //login.ejs 파일에 input name속성값을 필드로 저장
    usernameField: 'user_id',
    passwordField: 'user_pw',
    session: true, //로그인후 세션 저장할것인지 true/false
    passReqToCallback: false, //id/pw말고도 다른 정보 검증시
}, function (input_id, input_pw, done) {
    const query = {
        TableName: 'login_loveless',
        KeyConditionExpression: 'user_id = :user_id',
        ExpressionAttributeValues: {
            ':user_id': input_id
        }
    };

    docClient.query(query, (err, data) => {
        if (err) return done(err)
        if (data.Items[0] == ''){ return done(null, false, { message: '존재하지않는 아이디' })// done()은? 3개의 파라미터를 갖는다. 1.서버에러, 2.성공시사용자db데이터 확인, 3.에러메시지

    }else {
            if (input_pw == data.Items[0].user_pw) {
                return done(null, data);
            } else {
                return done(null, false, { message: '비밀번호가 일치하지 않습니다.' })
            }
        }
    })
}));

//세션정보를 암호화하여 저장시키는 코드(로그인 성공시 발동)
passport.serializeUser(function (user, done) {
    done(null, user.Items[0].user_id) //id를 이용해서 세션을 저장시키는 코드
});


passport.deserializeUser(function (아이디, done) {
    const query = {
        TableName: 'login_loveless',
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: {
            ':uid': 아이디
        }
    }
    docClient.query(query, (err, data) => {
        if (!err)
            // console.log(data.Items);
            done(null, data);
    })
});
