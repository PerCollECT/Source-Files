// Script provides helper functions

// check brower support of used methods, polyfill if not exists
if (!HTMLCollection.prototype.forEach) {
  HTMLCollection.prototype.forEach = Array.prototype.forEach;
}
/*if (!Object.prototype.forEach) {
  Object.prototype.forEach = Array.prototype.forEach;
}*/
if (!HTMLCollection.prototype.indexOf) {
  HTMLCollection.prototype.indexOf = Array.prototype.indexOf;
}

/**
* Keeps data in session storage
*/
function keepDataInSessionStorage(name, object) {
  window.sessionStorage.setItem(name, object);
}

/**
* Gets data from session storage
* @return data from session storage
*/
function getDataFromSessionStorage(name) {
  return window.sessionStorage.getItem(name);
}

/**
* Capitalizes the first letter of string
* @param {String} string 
* @returns manipulated string
*/
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Add info block of node
 * @param {Object} node 
 */
function addNodeInfos(node, id) {

  let infoBox = $("<div></div>")
    .addClass("info")
    .attr("id", function () { return id != undefined ? id : "" })
    .appendTo($("#info_box"));
  $('<div></div>')
    .addClass("infoHead")
    .html(node.title)
    .appendTo(infoBox);

  let table = document.createElement("table");

  // show node information
  let attributesToShow = [
    "id",
    "decomBlock",
    "description",
    "number of parent nodes",
    "number of child nodes",
    "references"];

  attributesToShow.forEach(function (a) {
    let value = [];

    switch (a) {
      case "id":
        value.push([a.toUpperCase(), node.id.replaceAll("\\n", "<br><br>")]);
        break;
      case "decomBlock":
        value.push(["Decomposition Block", node.decomBlock.replaceAll("\\n", "<br><br>")]);
        break;
      case "number of parent nodes":
        //value.push([a, getNumberOfParents(node)]);
        break;
      case "number of child nodes":
        //value.push([a, getNumberOfChildren(node)]);
        break;
      case "references":
        value = prepareReferencesInfo(node.references);
        value.forEach(function (e) {
          let nodeName = getNodeById(e[0].replaceAll(/[\s]/g, "")).title;
          let link = `${getLinkPath()}#${nodeName.replace(/[^A-Z0-9]/ig, "_").toLowerCase()}`;
          let output = [];
          e[0] = `Reference for influence on <a title='${e[0].replaceAll(/[\s]/g, "")}' onclick="navLink('${nodeName}')" style="cursor: pointer;">${nodeName}</a>`;
          reference = `<a href='${e[3].replaceAll(/[\s]/g, "")}' target='_blank'>${e[1]+':'+e[2]}</a>`;
          if (e.length > 4) {
            e[1] = `${reference}, ${e[4]}`;
            e.splice(2, 3);
          } else {
            e[1] = reference;
            e.splice(2, 2);
          }
        });
        break;      
      default:
        value.push([a, node[a].replaceAll("\\n", "<br><br>")]);
    }

    // caution: using jQuery to create table will cause an error
    // therefore DOM interface used
    value.forEach(function (e) {
      let tr = document.createElement("tr");
      let td1 = document.createElement("td");
      td1.setAttribute("id", "info_key");
      td1.innerHTML = capitalizeFirstLetter(e[0]);
      tr.appendChild(td1);
      let td2 = document.createElement("td");
      td2.innerHTML = e[1];
      tr.appendChild(td2);
      if (e.length > 2) {
        let td3 = document.createElement("td");
        td3.innerHTML = e[2];
        tr.appendChild(td3);
      }
      table.appendChild(tr)
    })
  });

  infoBox.append(table)
}

/**
 * Add legend to legend div
 */
function addLegend() {
  if ($("#tree_view").innerHTML == '') return;

  let colors = ["#f4f4f9", "#ace3b5", "#b4acd2"];
  let names = ["Effects", "System independent cause", "Design parameter"]
  for (let i = 0; i < colors.length; ++i) {
    $("<div></div>")
      .addClass("circle")
      .css("background", colors[i])
      .appendTo($("#legend"));
    $("<div></div>")
      .addClass("circle-text")
      .html(names[i])
      .appendTo($("#legend"));
  }
}

/**
 * Triggers search of tree
 */
function jumpToSearch() {
  let search = $("#search_input").val();
  if (!search) return;
  navLink(search);
}

/**
 * Adds autocomplete to search bar
 * @param {Object} input 
 * @returns 
 */
function addAutoComplete(input) {
  // TODO switch to jQuery

  let tree = JSON.parse(getDataFromSessionStorage(repoName + "Tree"));
  if (!tree) return;

  // collect all nodes names in tree
  let arr = [];
  let tagsArr = [];
  let tagsTitlesMap = {};//map that links each tag to its associated titles.
  tree.forEach(function (n) {
    if (!arr.includes(n.title)) {
      arr.push(n.title);
    }
    try{
      n.tags.forEach(function(tag){
        if(tagsTitlesMap.hasOwnProperty(tag))
        {
          tagsTitlesMap[tag].push(n.title);
        }
        else
        {
          tagsTitlesMap[tag] = [];
          tagsTitlesMap[tag].push(n.title);
        }
        if (!tagsArr.includes(tag)) {
          tagsArr.push(tag);
        }
      })
    }
    catch{
      console.log("tags property doesn't exist")
    }

  })

  let currentFocus;
  input.addEventListener("input", function () {
    let val = this.value;
    let titlesMap = {};//check if the title already in the search results to avoid duplicates.

    // close already open lists
    closeAllLists();
    if (!val) {
      return false;
    }
    currentFocus = -1;

    // create element containing the complete items
    let divContainer = document.createElement("div");
    divContainer.setAttribute("id", `${this.id}autocomplete-list`);
    divContainer.setAttribute("class", "autocomplete-items");

    // append auto complete items
    this.parentNode.appendChild(divContainer);
    arr.forEach(function (e) {
      titlesMap[e] = 0;
      let includes = checkSearchBarValue(e,val);
      if (includes) {
        titlesMap[e] = 1;
        let divEntry = document.createElement("div");
        let startIndex = e.toLowerCase().indexOf(val.toLowerCase());
        divEntry.innerHTML = e.substr(0, startIndex);
        divEntry.innerHTML += `<strong>${e.substr(startIndex, val.length)}</strong>`;
        divEntry.innerHTML += e.substr(startIndex + val.length, e.length);
        divEntry.innerHTML += `<input type='hidden' value='${e}'>`;
        divEntry.addEventListener("click", function () {
          input.value = this.getElementsByTagName("input")[0].value;
          closeAllLists();
          jumpToSearch();
        });
        divContainer.appendChild(divEntry);
      }
    });

    tagsArr.forEach(function (e) {
      let includes = checkSearchBarValue(e,val);
      if (includes) {
        tagsTitlesMap[e].forEach(function(title){
          if(titlesMap[title] === 0){
            titlesMap[title] = 1;
            let divEntry = document.createElement("div");
            divEntry.innerHTML = title;
            divEntry.innerHTML += `<input type='hidden' value='${title}'>`;
            divEntry.addEventListener("click", function () {
              input.value = this.getElementsByTagName("input")[0].value;
              closeAllLists();
              jumpToSearch();
            });
            divContainer.appendChild(divEntry);
          }
        })
      }
    });

  });

  function checkSearchBarValue(data,searchVal)
  {
    let includes = false;
    if (data.toLowerCase().includes(searchVal.toLowerCase())) {
      includes = true;
    }
    return includes;
  }

  // key pressed handler
  input.addEventListener("keydown", function (e) {
    let autoCompleteList = document.getElementById(`${this.id}autocomplete-list`);
    if (autoCompleteList) {
      autoCompleteList = autoCompleteList.getElementsByTagName("div");
    }
    if (e.keyCode == 40) {
      // if the down key is pressed
      currentFocus++;
      addActive(autoCompleteList);
    } else if (e.keyCode == 38) {
      // if the up key is pressed
      currentFocus--;
      addActive(autoCompleteList);
    } else if (e.keyCode == 13) {
      // if the enter key is pressed
      e.preventDefault();
      if (currentFocus > -1 && autoCompleteList) {
          autoCompleteList[currentFocus].click();
      }
      jumpToSearch();
    }
  });

  function addActive(autoCompleteList) {
    if (!autoCompleteList) return false;
    removeActive(autoCompleteList);
    if (currentFocus >= autoCompleteList.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (autoCompleteList.length - 1);
    autoCompleteList[currentFocus].classList.add("autocomplete-active");
  }

  function removeActive(autoCompleteList) {
    for (var i = 0; i < autoCompleteList.length; i++) {
      autoCompleteList[i].classList.remove("autocomplete-active");
    }
  }

  function closeAllLists(listElement) {
    var x = document.getElementsByClassName("autocomplete-items");
    x.forEach(function (e) {
      if (listElement != e && listElement != input) {
        e.parentNode.removeChild(e);
      }
    });

  }

  document.addEventListener("click", function (e) {
    closeAllLists(e.target);
  });
}

// helper methods

/**
 * Prepares value of attribute reference sof node for redering
 * @param {*} referenceString value of attribute references
 * @returns 
 */
function prepareReferencesInfo(referenceString){

  let preparedRefString = referenceString
  .replace("[", "")
  .replaceAll("]", "")
  //.replaceAll(/[\s]/g, "")
  .split("[")
  .filter(function (e) { return e != ""; });
  
  let value = [];
  for (item in preparedRefString) {
    value.push(preparedRefString[item].split(","));
  }

  return value;
}
/**
 * Get node children
 * @param {String} nodeId node ID
 * @param {Array} data tree data
 * @returns
 */
function getNodeChildren(nodeId,data)
{
  let children = [];
  data.forEach(function (elem) {
    if (elem.parentIds.includes(nodeId)) {
      children.push(elem)
    }
  });
  return children;
}
/**
 * Get node parents
 * @param {String} nodeId node ID
 * @param {Array} data tree data
 * @returns
 */
function getNodeParents(nodeId,data)
{
  let parents = []
  data.forEach(function (elem) {
    if (elem.id === nodeId) {
      parents =  elem.parentIds;
      return;
    }
  });
  return parents;
}

function addInfoBoxResizeBar()
{
  const infoBoxContainer = document.createElement('div');
  infoBoxContainer.classList.add('info_box_container');

  const resizeBar = document.createElement('div');
  resizeBar.classList.add('resize_bar');

  const infoBox = document.getElementById('info_box');
  infoBoxContainer.appendChild(resizeBar);
  infoBoxContainer.appendChild(infoBox);

  const content = document.getElementsByClassName('content');
  const treeTableContainer = document.getElementById('tree_table_container');
  content[0].insertBefore(infoBoxContainer,treeTableContainer);

// on mouse down (drag start)
  resizeBar.onmousedown = function dragMouseDown(e) {
    // get position of mouse
    let dragY = e.clientY;
    // register a mouse move listener if mouse is down
    document.onmousemove = function onMouseMove(e) {
      // e.clientY will be the position of the mouse as it has moved a bit now
      // offsetHeight is the height of the infoBox
      if(infoBoxContainer.offsetHeight - (e.clientY - dragY) >= 10 && e.clientY > 0)
      {
        infoBoxContainer.style.height = infoBoxContainer.offsetHeight - (e.clientY - dragY) + "px";
        // update variable - till this pos, mouse movement has been handled
        dragY = e.clientY;
      }
    }
    // remove mouse-move listener on mouse-up (drag is finished now)
    document.onmouseup = () => document.onmousemove = document.onmouseup = null;
  }
}

function addExpandAndCollapseTreeButtons()
{

  const buttonsContainer = document.createElement('div');
  buttonsContainer.classList.add('tree_buttons_container');

  const expandButton = document.createElement('div');
  expandButton.classList.add('tree_btn');
  expandButton.id = "expand_tree_btn";
  let expandText = document.createTextNode('Expand Tree');
  expandButton.appendChild(expandText);
  expandButton.addEventListener('click',function(){
    expandTree();
  });

  const collapseButton = document.createElement('div');
  collapseButton.classList.add('tree_btn');
  collapseButton.id = "collapse_tree_btn";
  let collapseText = document.createTextNode('Collapse Tree');
  collapseButton.appendChild(collapseText);
  collapseButton.addEventListener('click',function(){
    collapseTree();
  });
  buttonsContainer.appendChild(expandButton);
  buttonsContainer.appendChild(collapseButton);

  const content = document.getElementsByClassName('content');
  const infoBox = document.getElementById('info_box');

  content[0].insertBefore(buttonsContainer,infoBox);
}
