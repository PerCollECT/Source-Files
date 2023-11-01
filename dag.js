let scale;
let svgSelection;
let defs;
let layout;
let dag;
let nodes;
let graph;
let width = 600, height = 400;
let maxTextLength = 200;
let nodeWidth = maxTextLength + 20;
let nodeHeight = 140;
let shownNodesMap = {};
let shownNodeChildrenMap = {};
let currentTree = [];
let zoomTransform;

// Define the zoom function for the zoomable tree
var zoom = d3.zoom()
      .scaleExtent([1, 20])
      .on('zoom', function(event) {
        graph
            .attr('transform', event.transform);
        zoomTransform = event.transform;
});

// How to draw edges
const line = d3
.line()
.curve(d3.curveCatmullRom)
.x((d) => d.x + nodeWidth/2)
.y((d) => d.y + nodeHeight/2);


function initGraph() {
    // fetch data and render
    let data = JSON.parse(getDataFromSessionStorage(repoName + "Tree"));
    for(let i=0;i<data.length;i++)
    {
        if(data[i]["parentIds"].length === 0)
        {
            shownNodesMap[data[i]["id"]] = 1;
            currentTree.push(data[i]);
            NodeExpand(data[i]["id"],currentTree,data)
        }
        else{
            if(shownNodesMap[data[i]["id"]] !== 1)
            {
                shownNodesMap[data[i]["id"]] = 0;
            }
        }
    }
    for (let i = 0; i < data.length; i++)
    {
        if(shownNodesMap[data[i]["id"]] === 1)
        {
            RemoveHiddenParents(data[i]["parentIds"]);
        }
    }
    drawTree(currentTree,"init");
}

/**
 * Interface to parse all data starting at
 * @param {String} host of json file
 * @param {String} dataDict dictionary at domain where the data is located
 * @param {String} jsonRootFile file name of json file
 */
 function parseData(host, dataDict, jsonDataFile) {
  let jsonRootFullPath = (window.location.href.includes("localhost") || window.location.href.includes("127.0.")) ?
  `./${jsonDataFile}` : `${host}${dataDict}${jsonDataFile}`;

  let rawFile = new XMLHttpRequest();
  rawFile.open("GET", jsonRootFullPath, false);
  let allText;
  rawFile.onreadystatechange = function ()
  {
      if(rawFile.readyState === 4)
      {
          if(rawFile.status === 200 || rawFile.status == 0)
          {
              allText = rawFile.responseText;
          }
      }
  }
  rawFile.send(null);
  data = JSON.parse(allText);

  return data;
 }


 /**
  * Performs action after the info label is clicked
  * @param {Object} d clicked info
  */
 function onNodeInfoClicked(d) {
    let currentNodeId = d.currentTarget.__data__.data.id;
    let node = getNodeByTitle(d.currentTarget.__data__.data.title);
    $("#info_box").empty();
    addNodeInfos(node, "preview");
    document.getElementById("preview").scrollIntoView({ behavior: 'smooth' });
    updateGraphPlot(currentNodeId);
 }

/**
 * Performs action after the a node is clicked
 * @param {Object} d clicked info
 */
 function onNodeClicked(d) {
  let currentNodeId = d.currentTarget.__data__.data.id;
  let node = getNodeByTitle(d.currentTarget.__data__.data.title);
  $("#info_box").empty();
  addNodeInfos(node, "preview");
    document.getElementById("preview").scrollIntoView({ behavior: 'smooth' });
    updateGraphPlot(currentNodeId);
}

/**
 * Method wraps long labels of nodes into multiple line label
 * @param {String} text labels
 * @param {Number} width max width of one line
 */
 function wrapNodeText(text, width) {
  text.each(function (d) {
      let textd3 = d3.select(this);
      if (textd3.node().getComputedTextLength() < width) return;
      let words = textd3.text().split(" ").reverse();
      // split into lines
      let word;
      let line = [];
      let lineNumber = 0;
      let lineHeight = 1; // ems
      let x = textd3.attr('x');
      let y = textd3.attr('y');
      let dy = 0;
      let tspan = textd3.text(null)
          .append('tspan')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', dy );
      while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(' '));
          if (tspan.node().getComputedTextLength() > width) {
              line.pop();
              tspan.text(line.join(' '));
              line = [word];
              tspan = textd3.append('tspan')
                  .attr('x', x)
                  .attr('y', y)
                  .attr('dy', ++lineNumber * lineHeight + dy + 'em')
                  .text(word);
          }
      }
      // set new box height
  });
}

/**
 * Performs graph update. Updates nodes and links.
 * @param {Number} currentNodeId
 */
 function updateGraphPlot(currentNodeId) {
  graphs = graph.selectAll("path");
  paths = graphs._groups[0];
  paths.forEach(function (d) {
      source = d.__data__.source.data;
      target = d.__data__.target.data;
      if (currentNodeId == source.id) {
        d.setAttribute("stroke-width", "10");
        d.setAttribute("style", "stroke: rgb(255, 0, 0); transition: 0.5s");
      }
      else if (currentNodeId == target.id) {
        d.setAttribute("stroke-width", "10");
        d.setAttribute("style", "stroke: rgb(0, 0, 255); transition: 0.5s");
      }
      else {
        d.setAttribute("stroke-width", "1.5");
        d.setAttribute("style", "stroke: rgb(34, 34, 34); transition: 0.5s");
      }
  });
}
function onNodeExpandClicked(d) {
    let currentNodeId = d.currentTarget.__data__.data.id;
    let element = d.currentTarget
    updateTree(currentNodeId,"expand");
    element.setAttribute("fill","blue");
}
function onNodeCollapseClicked(d) {
    let currentNodeId = d.currentTarget.__data__.data.id;
    updateTree(currentNodeId,"collapse");
}
function updateTree(currentNodeId,state){
    let data = JSON.parse(getDataFromSessionStorage(repoName + "Tree"));
    let drawData = [];
    if(state === "expand")
    {
        NodeExpand(currentNodeId,currentTree,data);
    }
    else
    {
        NodeCollapse(currentNodeId,currentTree,data);
    }
    for (let i = 0; i < data.length; i++)
    {
        if(shownNodesMap[data[i]["id"]] === 1)
        {
            RemoveHiddenParents(data[i]["parentIds"]);
        }
    }
    drawTree(currentTree,"update");
    graph
        .attr('transform', zoomTransform);
}

function drawTree(drawData,state)
{
    dag = d3.dagStratify()(drawData);
    layout = d3
        .sugiyama() // base layout
        .decross(d3.decrossTwoLayer().order(d3.twolayerAgg())) // minimize number of crossings
        .nodeSize((node) => [(node ? 3.6 : 0.25) * nodeWidth, 2 * nodeWidth]); // set node size instead of constraining to fit
    const { width, height } = layout(dag);
    let sizeFactor = width/window.innerWidth

    // --------------------------------
    // This code only handles rendering
    // --------------------------------
    svgSelection = d3.select("svg");
    svgSelection.selectAll('*').remove();
    svgSelection.attr("viewBox", [0, 0, width, (window.innerHeight)*sizeFactor].join(" "));
    svgSelection.call(zoom);
    graph = svgSelection.append("g");

    defs = graph.append("defs"); // For gradients

    // Plot edges
    graph
        .append("g")
        .attr("class", "paths-list")
        .selectAll("path")
        .data(dag.links())
        .enter()
        .append("path")
        .attr("d", ({ points }) => line(points))
        .attr("fill", "none")
        .attr("stroke-width", 3)
        .style("stroke", "#222222");

    // Select nodes
    nodes = graph
        .append("g")
        .attr("class", "nodes-list")
        .selectAll("g")
        .data(dag.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", ({ x, y }) => `translate(${x}, ${y})`);

    // Plot nodes
    nodes
        .append("rect")
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("rx", function (d) {
            switch (d.data.nodeType) {
                case "designParameter":
                    return 40;
                case "systemIndependent":
                    return 40;
                default:
                    return 2;
            }
        })
        .attr("stroke-width", 1.5)
        .style("fill", function (d) {
            switch (d.data.nodeType) {
                case "designParameter":
                    return "#b4acd2";
                case "systemIndependent":
                    return "#ace3b5";
                default:
                    return "#f4f4f9";
            }
        })
        .on("click", onNodeClicked);

    // Add text to nodes
    nodes
        .append("text")
        .attr("y", nodeHeight / 2)
        .attr("x", 13)
        .attr("dy", ".35em")
        .text((d) => d.data.title)
        .call(wrapNodeText, maxTextLength)
        .on("click", onNodeClicked);

    // Add information icon
    nodes.append("circle")
        .attr("class", "iButton")
        .attr("cx", nodeWidth-20)
        .attr("cy", 20)
        .attr("r", 15)
        .on("mouseover", function () { d3.select(this).attr("r", 20); })
        .on("mouseout", function () { d3.select(this).attr("r", 15); })
        .on("click", onNodeInfoClicked);
    console.log(nodes[0])

    nodes.append("circle")
        // .attr("id", "expand")
        // .attr("class", "iButton")
        .attr("cx", nodeWidth/2)
        .attr("cy", nodeHeight)
        .attr("r", 12)
        .attr("fill","darkblue")
        .on("mouseover", function () { d3.select(this).attr("r", 15); })
        .on("mouseout", function () { d3.select(this).attr("r", 12); })
        .on("click", onNodeExpandClicked);

    nodes.append("circle")
        // .attr("id", "collapse")
        // .attr("class", "iButton")
        .attr("cx", nodeWidth/2)
        .attr("cy", 0)
        .attr("r", 12)
        .attr("fill","darkred")
        .on("mouseover", function () { d3.select(this).attr("r", 15); })
        .on("mouseout", function () { d3.select(this).attr("r", 12); })
        .on("click", onNodeCollapseClicked);

    nodes.append("text")
        .attr("class", "iText")
        .attr("y", 26.5)
        .attr("x", nodeWidth - 20 - (5 / 2))
        .html("i");
}

function NodeExpand(currentNodeId,currentTree,data)
{
    for(let i = 0;i<data.length;i++)
    {
        if(data[i]["parentIds"].includes(currentNodeId))
        {
            // RemoveHiddenParents(data[i]["parentIds"]);
            if(shownNodesMap[data[i]["id"]] === 1)
            {
                for(let j = 0;j<currentTree.length;j++)
                {
                    if(currentTree[j]["id"] === data[i]["id"])
                    {
                        if(!currentTree[j]["parentIds"].includes(currentNodeId))
                        {
                            currentTree[j]["parentIds"].push(currentNodeId);
                        }
                        break;
                    }
                }
            }
            else{
                shownNodesMap[data[i]["id"]] = 1;
                currentTree.push(data[i]);
            }
        }
    }
}

function NodeCollapse(currentNodeId,currentTree,data)
{
    let childrenQueue = [];
    childrenQueue.push(currentNodeId);
    while(childrenQueue.length !== 0)
    {
        for(let i = 0;i<currentTree.length;i++)
        {
            for(let j = 0;j<currentTree[i]["parentIds"].length;j++)
            {
                if(currentTree[i]["parentIds"][j] === currentNodeId)
                {
                    currentTree[i]["parentIds"].splice(j, 1);
                    if(currentTree[i]["parentIds"].length === 0)
                    {
                        childrenQueue.push(currentTree[i]["id"]);
                        shownNodesMap[currentTree[i]["id"]] = 0;
                    }
                    break;
                }
            }
        }
        childrenQueue.shift();
        if(childrenQueue.length !== 0)
        {
            currentNodeId = childrenQueue[0];
        }
    }
    let itr = 0;
    while(itr<currentTree.length)
    {
        if(shownNodesMap[currentTree[itr]["id"]] === 0)
        {
            currentTree.splice(itr, 1);
        }
        else{
            itr++;
        }
    }
}


function RemoveHiddenParents(parents)
{
    let j = 0;
    while(j<parents.length)
    {
        if(shownNodesMap[parents[j]] === 0)
        {
            parents.splice(j, 1);
        }
        else
        {
            j++;
        }
    }
}
