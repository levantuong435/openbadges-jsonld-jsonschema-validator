#!/usr/bin/env node

const fs = require('fs');
const argv = require('optimist').argv;
const parse = require('../');
const input = argv._[0];
var infile = argv.in||argv.infile;;

const JaySchema = require('jayschema');
const jay = new JaySchema();
const jaynorm = require('jayschema-error-messages');
//const bs = require('../badgeSchema.js');

const jsonld = require('jsonld');
const contexts = require('../contexts.js');
jsonld.documentLoader = contexts;

function readAssertion(infile) {
  fs.readFile(infile, 'utf8', function(err, data) {
    if (err) throw err;
    console.log('OK: ' + infile);
    
    if(isJson(data)){      
      console.log('File successfully read as JSON.');
      data = JSON.parse(data);
     
     jsonld.expand(data, function(err, expanded) {
       // Not valid JSONLD. Return error and exit.
       if (err) {
         console.log("Invalid (JSON-LD Error): " +err);
         process.exit(1);
       }

       // Not JSONLD. Continue to validate against schmema.
       if (expanded.length == 0) {
         console.log('This is not JSONLD');
       }
       // Get the validation link
       else {
        var mainContextUrl = parseAssertionForMainContext(data)
        console.log("I'm gonna fetch something for: " + mainContextUrl);

        contexts(mainContextUrl,function(err,contextResult){
          if (err) throw err;
          var validationUrl = contextResult.document.validation;
          if (typeof validationUrl === 'string'){
            console.log("Successfully retrieved the validation URL. It is: " + validationUrl);
            stillMissingSchema = jay.register(fs.readFileSync('files/test-OBI-schema.json'),validationUrl);
            stillMissingSchema.concat(jay.register(fs.readFileSync('files/test-OBI-schema.json'),'http://openbadges.org/schema/extension1'));
            if (stillMissingSchema.length === 0){
              jay.validate(data, validationUrl, function(validationErrs){
                if (validationErrs){
                  console.log("Schema validation errors follow:");
                  console.log(jaynorm(validationErrs));
                } 
                else{
                  console.log("GREATEST SUCCESS OF THE PEOPLE: VALIDATION OF ASSERTION AGAINST ITS SCHEMA PASSSED WITH NO ERRORS.");
                }
              });
            }
          }
        });
       }
       console.log("\n=================== THE EXPANDED RESULTS =================")
       console.log(JSON.stringify(expanded,null,"  "));
     });
     
    // Not valid JSON. Return error and exit.
    } else {
      console.log("Invalid: File data is not JSON.");
      process.exit(1);
    }    
  }); 
}

function parseAssertionForMainContext(assertion){
  var dig = function(context){
    if (typeof context === 'string'){
      return context;
    }
    else if (Array.isArray(context)){
      return dig(context[0]);
    }
    else {
      throw new Error("I couldn't find a URL in the context");
    }
  };
  
  if(assertion['@context'])
    return dig(assertion['@context']);
  else
    throw "This JSON didn't have any @context property.";

}

// shell script operation control
// I recommend starting from the app root directory and using shell command `./bin/parser.js --in files/example-assertion.json `
(function main() {
  infile = argv.in||argv.infile;
  if (!infile)  {
    console.log('File not provided. Using default Mojito recipe.');
    infile = "./files/test-recipe.json";
  }  
  readAssertion(infile);
})()

process.on('SIGINT', function () {
  log('interrupt');
  process.exit(2);
});

//utils
function isJson(str) {
  try { JSON.parse(str); return true }
  catch(e) { return false }
}