const changedGitFiles = require("changed-git-files");
const chalk = require("chalk");
const findUp = require("find-up");
const fs = require("fs");

const main = async function() {
  console.log();
  console.log(chalk.yellow("✨ 🌈   Beginning auto-csproj..."));

  const csProjFilename = process.argv.slice(2)[0] || "SmashFlyApi.csproj";

  // Find the csproj that we're going to modify.
  let csProjFilePath;
  try {
    csProjFilePath = await findUp(csProjFilename, { cwd: changedGitFiles.cwd });
    if (!csProjFilePath) {
      throw true;
    }
  } catch (e) {
    console.error(`Could not find ${csProjFilename}.`);
    console.log();
    return;
  }

  // Get all the added and removed files that will require
  // modifications to the specified csproj file.
  let addedFiles = [];
  let removedFiles = [];

  let addCount = 0;
  let removeCount = 0;
  changedGitFiles((err, results) => {
    let removalPrefix = csProjFilename.split(".csproj")[0] + "/";

    results.forEach(result => {
      let newFilepath = result.filename.split(removalPrefix)[1];
      newFilepath = newFilepath.split("/").join("\\");
      newFilepath = `    <Content Include="${newFilepath}" />`;

      if (result.status === "Added") {
        addedFiles.push(newFilepath);
      } else if (result.status === "Deleted") {
        removedFiles.push(newFilepath);
      }
    });

    // Insert the added files into the second ItemGroup.
    var csProjContent = fs
      .readFileSync(csProjFilePath)
      .toString()
      .split("\n");

    let insertionIndex;
    let foundOne = false;
    csProjContent.forEach((contentLine, index) => {
      if (contentLine.includes("<ItemGroup>")) {
        if (!foundOne) {
          foundOne = true;
        } else if (foundOne && !insertionIndex) {
          insertionIndex = index + 1;
        }
      }
    });

    addedFiles.forEach(addedFile => {
      if (!csProjContent.includes(addedFile)) {
        csProjContent.splice(insertionIndex, 0, addedFile);
        insertionIndex += 1;
        addCount += 1;
      }
    });

    // Remove the removed files from the csproj.
    let removalIndices = [];
    removedFiles.forEach(removedFile => {
      csProjContent.forEach((contentLine, index) => {
        if (contentLine.includes(removedFile)) {
          removalIndices.push(index);
        }
      });
    });

    removalIndices = removalIndices.sort((a, b) => {
      return b - a;
    });

    removalIndices.forEach(removalIndex => {
      csProjContent.splice(removalIndex, 1);
      removeCount += 1;
    });

    let text = csProjContent.join("\n");
    fs.writeFile(csProjFilePath, text, err => {
      if (err) return console.error(err);
    });

    let updateString = "";
    if (addCount) {
      updateString += `${chalk.green(addCount + " added. ")}`;
    }

    if (removeCount) {
      updateString += `${chalk.red(removeCount + " removed.")}`;
    }

    if (addCount || removeCount) {
      console.log("      " + updateString);
      console.log("      😎  All done.");
    } else {
      console.log("No additions or removals. The csproj is untouched.");
    }

    console.log();
  });

  return;
};

exports.main = main;
