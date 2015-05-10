var fs = require("fs-extra");
var deferred = require('deferred');
var exec = require('child_process').exec;
var unzip = require('unzip');
var archiver = require('archiver');
var AdmZip = require('adm-zip');
var zipdir = require('zip-dir');
var zipFolder = require('zip-folder');



zipFolder('C:/Users/User/WebstormProjects/processing_the_data/data/0',
    'C:/Users/User/WebstormProjects/processing_the_data/data/1.ZIP', function(err) {
    if(err) {
        console.log('oh no!', err);
    } else {
        console.log('EXCELLENT');
    }
});