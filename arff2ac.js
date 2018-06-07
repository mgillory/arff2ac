// file system module
const fs = require('fs');
// parse command line arguments
const minimist = require('minimist');

var args = minimist(process.argv.slice(2), {
  alias: {
    i: 'input',
    o: 'output',
    h: 'help',
    v: 'verbose'
  },
  default: {
    i: undefined,
    o: 'output',
    h: null,
    v: null,
    id: false,
    class: undefined
  },
});
const HELP_MESSAGE = "\n\x1b[47m\x1b[30mUsage\x1b[0m: node path/arff2ac.js INPUT_FLAGS input.arff [OPTIONS]\n\n \
      INPUT_FLAGS   = -i OR --input    inputname.arff                                    \x1b[33mREQUIRED\x1b[0m\n \
      OPTIONS       = --class          column number [1-max] if class is not last column \x1b[35mCONDITIONAL\x1b[0m\n \
                      --id             ignores first column, commonly used as id         \x1b[35mCONDITIONAL\x1b[0m\n \
                      -o OR --output   outputfile                                        \x1b[36mOPTIONAL\x1b[0m\n \
                      -v OR --verbose  print mapping matrix for check purposes           \x1b[36mOPTIONAL\x1b[0m\n \
                      -h OR --help     for help                                          \x1b[36mOPTIONAL\x1b[0m\n";
var mappingMatrix = [];
var equalAttrValues = [];
var id = 1;
var matrixIndex = 0;
var missingValues = 0;
var constantColumns = 0;

convert = (input, output) => {
  fs.readFile(input, 'utf8', (error, data) => {
    if (error) {
      console.log(error);
      process.exit(1);
    }
    arff2ac(data, output);
  });
}

arff2ac = (arff, output) => {
  const lines = arff.split("\n");
  const logger = fs.createWriteStream(output, {
    flags: 'a' // 'a' means appending (old data will be preserved)
  });

  var first = true;
  var classNotLast;
  let i = 0;
  var attrIndex = 0;
  for (i = 0; i < lines.length; i++) {
    const section = lines[i].split(" ");
    if (section[0] === '@attribute') {
      if(args.class && args.class === i - 1) {
        classNotLast = section;
        continue;
        console.log(classNotLast)
      }
      if (args.id && first) first = false;
      else mapping(section[section.length - 2], section[section.length - 1], attrIndex);

      ++attrIndex;
    }
    else if (section[0].replace(/\r|\n/g, "") === '@data') break;
  }

  if(args.class) mapping(classNotLast[classNotLast.length - 2], classNotLast[classNotLast.length - 1], attrIndex);
  generateOutput(lines, i + 1, logger);
  if (args.verbose !== null) verbose();
}

mapping = (attribute, distincts, attrIndex) => {
  distincts = distincts.replace(/\r|\\|'|{|}/g, "").split(",");
  //if(attribute.trim() === 'class') console.log(distincts)
  mappingMatrix[matrixIndex] = new Array();
  for (let i = 0; i < distincts.length; i++) {
    let obj = {};
    if(distincts.length === 1) {
      equalAttrValues.push(attrIndex);
      ++constantColumns;
      obj.attr = "";
      obj.value = "";
      obj.map = -1;
    }
    else {
      obj.attr = attribute.trim();
      obj.value = distincts[i];
      obj.map = id++;
    }
    mappingMatrix[matrixIndex].push(obj);
  }
  ++matrixIndex;
}

generateOutput = (lines, initialDataIndex, logger) => {
  for (let i = initialDataIndex; i < lines.length; i++) {
    var classId;
    if (lines[i].trim().replace(/\r|\n/g, "") !== '') {
      const attributes = lines[i].split(",");
      let newLine = "";
      let initial = args.id ? 1 : 0;
      for (j = initial; j < attributes.length; j++) {
        if (attributes[j] !== '?' && !equalAttrValues.includes(j)) {
          const index = args.class === j + 1 ? mappingMatrix.length - 1 : args.id || j + 1 > args.class ? j - 1 : j;
          const id = findAttrMapping(attributes[j], index);
          if(args.class === j + 1) classId = id;
          else newLine += id;
          if (j !== attributes.length - 1 && args.class !== j + 1) newLine += " ";
        }
        else if(!equalAttrValues.includes(j)) ++missingValues;
      }
      if(args.class) newLine += " " + classId;
      logger.write(newLine + "\n");
    }
  }
}

findAttrMapping = (attribute, index) => {
  for (let i = 0; i < mappingMatrix[index].length; i++) {
    if (mappingMatrix[index][i].value === attribute.replace(/\r|\\|'/g, ""))
      return mappingMatrix[index][i].map;
  }
}

verbose = () => {
  console.log("\nNumber of attributes: " + mappingMatrix.length);
  console.log("Missing values: " + missingValues);
  console.log("Constant columns eliminated: " + constantColumns);
  console.log("\nMATRIX OUTPUT:");
  for (let i = 0; i < mappingMatrix.length; i++) {
    if(mappingMatrix[i][0].map !== -1) {
      console.log("\n" + mappingMatrix[i][0].attr + " (original - mapping)\n");
      for (let j = 0; j < mappingMatrix[i].length; j++) {
        console.log(mappingMatrix[i][j].value + " - " + mappingMatrix[i][j].map);
      }
    }
  }
}

processArgs = () => {
  if (args.help || args.input === undefined || args.output === true) {
    console.log(HELP_MESSAGE);
    process.exit(0);
  }
}

main = () => {
  processArgs();
  convert(args.input, args.output);
}

main();