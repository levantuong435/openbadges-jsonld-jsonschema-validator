#!/usr/bin/env node
const _ = require('lodash');
const pointer = require('json-pointer');

const clc = require('cli-color');
const argv = require('optimist').argv;
const parse = require('../');
const input = argv._[0];
var infile = argv.in||argv.infile;

const schemaLoader = require('../schemaLoader.js');
const JaySchema = require('jayschema');
const jay = new JaySchema(schemaLoader);
const jaynorm = require('jayschema-error-messages');

const jsonld = require('jsonld');
const contexts = require('../contexts.js');
jsonld.documentLoader = contexts;



// shell script operation control
// I recommend starting from the app root directory and using shell command `./bin/parser.js --in files/example-assertion.json `
(function main() {
  infile = argv.in||argv.infile;
  if (!infile)  {
    console.log('File not provided. Using default example assertion.');
    infile = "./files/example-assertion.json";
  }  
  readAssertion(infile);
})()



// Presently, it only validates the complete object against the schema declared in the OBI assertion context file.
function openBadgesValidator(validationUrl,data){ 

  /* build a list of validation directives, and process them when it's ready.
  // directives is an array of objects { pointer, context, schemaRef }
  */
  analyzeBadgeObjectForValidation(data, function(err, directives){
    if(err){
      console.log("Error analyzing badge object: " + err);
      process.exit(1);
    }

    var directive;
    for (var i=0; i<directives.length; i++){
      directive = directives[i];

    }
  });





  if (typeof validationUrl != 'string'){ 
    validationUrl = "https://app.achievery.com/tmp/test-OBI-schema.json";
  }



  validateMain(validationUrl, data);

  function validateMain(validationUrl, data){
    jay.validate(data, validationUrl, function(validationErrs){
      if (validationErrs){
        console.log("Schema validation errors follow:");
        console.log(clc.yellow(JSON.stringify(jaynorm(validationErrs))));
        //process.exit(1);
      } 
      else{
        console.log("GREATEST SUCCESS OF THE PEOPLE: VALIDATION OF ASSERTION AGAINST ITS SCHEMA PASSSED WITH NO ERRORS.");
        //process.exit(1);
      }
    });
  }
}




/* We expect one of two cases for the contents of the context property:
// 
// The first, for un-extended badges, is that @context will be a simple string URL to the context definition for the version of the OBI used.
//
// The second, is that @context will be an array, with the OBI context URL as string first element
// ... and an object as the second element with keys indicating the extended property name and values of a URI with information about the extension.
// .. extensions @context objects are referenced within the extended object itself in order to properly scope mappings.
*/
function analyzeBadgeObjectForValidation(data, readyToValidate){
  var mainContextBlock = data['@context'];

  // An array of objects describing validations to run on the Badge Object (data)
  // each: { 'pointer', 'contextRef', 'schemaRef' }
  var results = [];

  //quick counter of results processed (pass or fail) to evaluate doneness of array-parsing
  var possibleDirectives = 0;
  var processed = 0;

  //basic OBI assertion with no extensions just needs a single step:
  if (typeof mainContextBlock === 'string'){
    
    getSchemaForContext(mainContextBlock, function(err, schemaRef){
      if (err) console.log("Couldn't get schema reference for context doc: " + curContext);
      else{
        addRow('/',mainContextBlock, schemaRef);
        readyToValidate(results);
      }
    });
  }

  //Or the extended format, which needs a few passes.
  else if (Array.isArray(mainContextBlock)) {
    
    for (var i=0; i<mainContextBlock.length; i++){
      var curContext = mainContextBlock[i];

      // for the basic OBI schema &/or any other schema that applies to top level document
      if (typeof curContext === 'string') {
        possibleDirectives++;
        getSchemaForContext(curContext, function(err, schemaRef){
          if (err) console.log("Couldn't get schema reference for context doc: " + curContext);
          else{
            addRow('/', curContext, schemaRef);
            processedOne();
          }
        });
        
      }

      // for key:IRI mappings declaring badge object extensions
      else if (typeof curContext === 'object' && !Array.isArray(curContext)){
        for (key in curContext){
          
          // We expect a key for the property name of the extended object; it's value doesn't matter right now as long as it's probably an IRI.
          if (typeof curContext[key] === 'string'){
            possibleDirectives++;
            getInfoForProp(data, key, function(err, pointer, contextRef, schemaRef){
              if(err) console.log("Warning: Couldn't find pointer for " + key);
              else
                addRow(pointer, contextRef, schemaRef);
              processedOne();
            });
          }
        }
      }
    }
  }
  

  function addRow(pointer, contextRef, schemaRef){
    results.push({
      pointer: pointer,
      contextRef: contextRef,
      schemaRef: schemaRef
    });        
  }

  function processedOne(){
    processed++;
    if (processed === possibleDirectives){
      readyToValidate(results);
    }
  }
}





function getSchemaForContext(contextRef, callback){
  contexts(contextRef, function(err, contextResult){
    if (err || typeof contextResult.document['validation'] != 'string') 
      callback(err || new Error("Error: " + contextRef + " -- The context file's validation property wasn't a string, maaan."), null);
    else
      callback(null, contextResult.document['validation']);
  });
}


// callback has signature (err, pointer, contextRef, schemaRef)
function getInfoForProp(data, property, callback){

  var pointer, contextRef;

  //check if it's a top level property
  if (_.has(data,property)){
    pointer = '/' + property;
    contextRef = nab_context(data[property]);
  }
  else if (typeof data.badge === 'object' && _.has(data.badge,property)) {
    pointer = '/badge/' + property;
    contextRef = nab_context(data.badge[property]);
  }
  else if (typeof data.badge.issuer === 'object' && _.has(data.badge.issuer,property)) {
    pointer = '/badge/issuer/' + property;
    contextRef = nab_context(data.badge.issuer[property]);
  }

  getSchemaForContext(contextRef,function(err, schemaRef){
    if(err)
      console.log("Error getting schema for contextRef " + contextRef + " -- Not adding to validation list.");
    else if (typeof contextRef === 'string')
      callback(null, pointer, contextRef, schemaRef);
  });
  


  function nab_context(prop){
    if (typeof prop['@context'] === 'string')
      return prop['@context'];
    return null;
  }

  function return_result(){
    if (contextRef)
      callback(null, pointer, contextRef);
  }
}






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
         console.log('This is not JSONLD. Validate against Schema.');
         openBadgesValidator(null,data);
       }
       // Get the validation link
       else {
        contexts(data["@context"][0],function(err,contextResult){
          if (err) {
            console.log(err);
            process.exit(1);
          }
          var validationUrl = contextResult.document.validation; 
          if (typeof validationUrl === 'string'){
            console.log("Successfully parsed the main validation URL: " + validationUrl);
            openBadgesValidator(validationUrl,data);
          }
        });
       }
     });
     
    // Not valid JSON. Return error and exit.
    } else {
      console.log("Invalid: File data is not JSON.");
      process.exit(1);
    }    
  }); 
}

process.on('SIGINT', function () {
  log('interrupt');
  process.exit(2);
});

//utils
function isJson(str) {
  try { JSON.parse(str); return true }
  catch(e) { return false }
}