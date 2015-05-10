//----------------------------------------requirements--------------------------------------//
var fs = require("fs-extra");
var deferred = require('deferred');
var exec = require('child_process').exec;
var unzip = require('unzip2');
var archiver = require('archiver');

var configs = require('./config');
//end


var importantfiles = configs.important;
//------------------------------------class folder-------------------------------------//
function foldertype(addr)
{
    //constructor
    var path = addr;
    path = path.replace(/\\/g,"/");
    if(path.slice(-1)== "/") path = path.slice(0,-1);

    //methods
    this.exists = function()
    {
        return fs.existsSync(this.getpath());
    };
    this.makeit = function()
    {
        var def = deferred();
        if(this.exists()) def.resolve();
        else fs.mkdirs(this.getpath(), function (err) {
            if (err) def.reject(err);
            else def.resolve();
        });
        return def.promise;
    };
    this.subdir = function(sub)
    {
        return new foldertype(this.getfpath() + sub);
    };
    this.getpath = function(){ return path };
    this.getfpath = function(){ return path + "/" };
    this.getfilenames = function(){return fs.readdirSync(this.getpath()); };
    this.getfiles = function()
    {
        var filenames = this.getfilenames(), i, ret = new Array();
        for(i = 0;i<filenames.length;i++)
            ret.push(new filetype(this,filenames[i]));
        return ret;
    };
    this.deleteUnimportantFiles = function()
    {
        var def = deferred();
        var promisArr = new Array();
        var files = this.getfiles();
        var i;
        for(i=0;i<files.length;i++)
        {
            if(!files[i].isimportant()) promisArr.push(files[i].delete());
        }
        if(promisArr.length==0) def.resolve();
        else
        {
            var waitforall = deferred.apply(null,promisArr);
            waitforall(function(){
                def.resolve();
            });
        }
        return def.promise;
    };
    this.copyfilesto = function(tofolder)
    {
        var files = this.getfiles();
        var i;
        for(i=0;i<files.length;i++) files[i].copyto(tofolder);
    };
    this.existsfile = function(filename)
    {
        return fs.existsSync(this.getfpath() + filename);
    };
    this.foldername = function()
    {
        var from = path.lastIndexOf("/") + 1;
        return path.slice(from);
    };
    this.zipit = function(tofile)
    {
        var def = deferred();
        var archive = archiver('zip');
        archive.directory(this.getpath(), this.foldername());
        var output = fs.createWriteStream(tofile.getpath());
        output.on('close', function () {
            def.resolve();
        });
        archive.on('error', function(err){
            def.reject(err);
        });
        archive.pipe(output);
        archive.finalize();
        return def.promise;
    };
    this.deletethesefiles = function(filenames)
    {
        var def = deferred();
        var files = new Array(), i;
        for(i=0;i<filenames.length;i++)
            files.push(new filetype(this,filenames[i]));
        var promisArr = new Array();
        for(i=0;i<files.length;i++)
            promisArr.push(files[i].delete());
        if(promisArr.length==0) def.resolve();
        else
        {
            var waitforall = deferred.apply(null,promisArr);
            waitforall(function(){
                def.resolve();
            });
        }
        return def.promise;
    };
    this.deleteit = function()
    {
        var def = deferred();
        fs.remove(this.getpath(),function(err){
            if (err) def.reject('couldnt delete');
            else def.resolve();
        });
        return def.promise;
    };
}

//folders
var zipfolder = new foldertype(configs.zipdir);
var checkerfolder = new foldertype(configs.checkerfolder);
var problemfinderfolder = new foldertype(configs.problemfinderfold);
//--------------------------------------class file-------------------------------------//
function filetype(folder1, filename1)
{
    //constructor
    var folder = folder1;
    var filename = filename1;
    //methods
    this.isimportant = function()
    {
        var i;
        for(i=0;i<importantfiles.length;i++)
            if(importantfiles[i]==filename) return true;
        return false;
    };
    this.getpath = function() {
        return folder.getfpath() + filename;
    };
    this.iszip = function() {
        return filename.slice(-4).toLowerCase() == ".zip";
    };
    this.unzipit = function()
    {
        var def = deferred();
        if(!this.iszip())
        {
            def.reject("wrong type");
            return def.promise;
        }

        var tmp = fs.createReadStream(this.getpath())
            .pipe(unzip.Extract({ path: folder.getpath() }))
            .on('close',function(){
                def.resolve();
            });
        return def.promise;
    };
    this.trytodelete = function()
    {
        var def = deferred();
        fs.unlink(this.getpath(), function (err) {
            if (err) def.reject('C');
            else def.resolve();
        });
        return def.promise;
    };
    this.delete = function(a)
    {
        a = typeof a != 'undefined' ? a : 0;
        var def = deferred();

        if(a==1000) /// qani varkyan porci jnji file-@
        {
            console.log("couldn't delete the file: " + this.getpath());
            def.reject("time limit");
            return def.promise;
        }

        var thisfile = this;
        this.trytodelete()(function(){
            def.resolve();
        },function(err){
            if(err!='C') console.log(err);
            setTimeout(function () {
                thisfile.delete(a+1)(function(){
                    def.resolve();
                },function(err){
                    def.reject(err);
                });
            }, 1000);
        });
        return def.promise;
    };
    this.fileinfo = function()
    {
        var def = deferred();
        fs.stat(this.getpath(), function(err,stats)
        {
            if(err) def.reject(err);
            def.resolve(stats);
        });
        return def.promise;
    };
    this.copyto = function(tofolder)
    {
        fs.copySync(this.getpath(),tofolder.getfpath() + filename);
    };
    this.runexec = function()
    {
        var def = deferred();
        var child = exec(this.getpath(),{cwd: folder.getfpath()},
            function (error, stdout, stderr) {
                def.resolve();
            });
        return def.promise;
    };
    this.appendto = function(tofile)
    {
        var def = deferred();
        var rstream = fs.createReadStream(this.getpath());
        var wstream = fs.createWriteStream(tofile.getpath(), {flags: 'a'});
        wstream.on('finish',function(){
            def.resolve();
        });
        rstream.pipe(wstream).on('end',function(){
            wstream.end();
        });
        return def.promise;
    }
}

//-------------------------------run cpp program---------------------------------------//
var runcpp = function(runfolder, infolder, runfilename)
{
    var def = deferred();

    var resolved = deferred(1);
    runfolder.copyfilesto(infolder);
    var runfile = new filetype(infolder,runfilename);
    resolved
    (function () { return runfile.runexec();})
    (function () { return infolder.deletethesefiles(runfolder.getfilenames());})
        .done(function(){
            def.resolve();
        });

    return def.promise;
};

//--------------------------------error file------------------------------------------//
var create_error = function(infolder)
{
    var def = deferred();
    if(infolder.existsfile("errors")) def.resolve();
    else
    {
        runcpp(checkerfolder, infolder, configs.runexe)(function(){
            def.resolve();
        });
    }
    return def.promise;
};

//-----------------------------------problems finder----------------------------------//
var find_problems = function(infolder)
{
    var def = deferred();
    runcpp(problemfinderfolder, infolder, configs.problemexe)(function(){
        def.resolve();
    });
    return def.promise;
};

//---------------------------------problem.txt doesn't exists------------------------------//
//reject if it exists
var no_problemtxt = function(infolder)
{
    var def = deferred();
    if(infolder.existsfile(configs.problemfile)) def.reject("problem.txt");
    else def.resolve();
    return def.promise;
};

//----------------------------------copy errors-------------------------------------//
var copy_errors = function(from_folder, tofoldername)
{
    var def = deferred();
    ///////// copy error file
    var errorfile = new filetype(from_folder,configs.errorfile);
    var tofolder1 = new foldertype(configs.errorstofolder);
    var tofolder = tofolder1.subdir(tofoldername);
    var tofile = new filetype(tofolder,configs.errorstofilename);
    var resolved = deferred(1);
    resolved
    (function(){return tofolder.makeit()})
    (function(){return errorfile.appendto(tofile);})
        .done(function(){
            def.resolve();
        },function(err){
            def.reject(err);
        });
    return def.promise();
};

//----------------------------------processing a zip file---------------------------------//

var processzip = function(zipnumber) {
    var def = deferred();

    console.log('processing the zip with number: ' + zipnumber);
    var zipfile = new filetype(zipfolder,zipnumber + ".ZIP");
    var subd;
    var resolved = deferred(1);
    resolved
    (function(){ console.log('hasa1'); return zipfile.unzipit();})
    (function(){ console.log('hasa2'); subd = zipfolder.subdir(zipnumber.toString()); return deferred(1);})
    (function(){ console.log('hasa3'); return subd.deleteUnimportantFiles();})
    (function(){ console.log('hasa4'); return create_error(subd);})
    (function(){ console.log('hasa5'); return find_problems(subd);})
    (function(){ console.log('hasa6'); return no_problemtxt(subd);})
    (function(){ console.log('hasa7');  return copy_errors(subd, Math.floor(zipnumber/10).toString());})
    (function(){ console.log('hasa8'); return zipfile.delete();})
    (function(){ console.log('hasa9'); return subd.zipit(zipfile);})
    (function(){ console.log('hasa10'); return subd.deleteit();})
        .done(function(){
            def.resolve();
        },
        function(err)
        {
            def.reject(err);
        }
    );
    return def.promise;
};

//----------------------------------processing zip files---------------------------------//
var processzips = function(from,to)
{
    var def = deferred();

    if(from == to + 1)
    {
        def.resolve();
        return def.promise;
    }

    processzip(from)
    (function(){ return deferred(1); }, function(err){
        console.log("failed: " + err + "***********************");
        return deferred(1);
    })
    (function(){ return processzips(from+1,to)})
        .done(function(){
            def.resolve();
        }, function()
        {
            var i;
            console.log("something went wrong**********************");
            def.reject("something went wrong");
        });
    return def.promise;
};

//----------------------------------the main function---------------------------------//
var start_program = function()
{
    if(process.argv.length!=4)
    {
        console.log('wrong number of arguments');
        console.log('usage: node find_errors.js from_zipnumber to_zipnumber');
        console.log('node find_errors.js 0 400');
        return;
    }
    var from = parseInt(process.argv[2]);
    var to = parseInt(process.argv[3]);
    processzips(from, to)
    (function () {
        console.log('done');
    }, function (err) {
        console.log('failed: ' + err);
    });
};

start_program();