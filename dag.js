let treeData;
let svgSelection;
let defs;
let layout;
let dag;
let nodes;
let graph;
let width = 600, height = 400;
let viewboxWidth = 11000, viewboxHeight = 10000;
let maxTextLength = 200;
let nodeWidth = maxTextLength + 20;
let nodeHeight = 140;
let shownNodesMap = {};
let nodeChildrenStateMap = {};
let nodeParentsStateMap = {};
let leavesNodesIds = [];
let rootsNodesIds = [];
let rootsNodesCoord = {};
let currentTree = [];
let zoomTransform;
let currentHighlightedNodeId;

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

/**
 * Initialize tree with the two top layers nodes
 */
function initGraph() {
    // fetch data and render
    treeData = JSON.parse(getDataFromSessionStorage(repoName + "Tree"));
    let data = structuredClone(treeData); // A clone is made to avoid any modifications in the original data
    for(let i=0;i<data.length;i++)
    {
        // Expand the nodes with no parents and initialize shownNodesMap with the shown nodes in the tree
        // and nodeChildrenStateMap with the state of the node children(expanded or collapsed)
        if(data[i]["parentIds"].length === 0)
        {
            shownNodesMap[data[i]["id"]] = 1;
            currentTree.push(data[i]);
            nodeChildrenExpand(data[i]["id"],data)
            rootsNodesIds.push(data[i]["id"]);
            rootsNodesCoord[data[i]["id"]] = [];
        }
        else{
            if(shownNodesMap[data[i]["id"]] !== 1)
            {
                shownNodesMap[data[i]["id"]] = 0;
            }
        }
        // Get nodes with no children to draw them without children expand/collapse button
        if(getNodeChildren(data[i]["id"],data).length === 0)
        {
            leavesNodesIds.push(data[i]["id"])
        }
    }
    // Remove hidden parents of the nodes in the currentTree
    for (let i = 0; i < currentTree.length; i++)
    {
        if(shownNodesMap[currentTree[i]["id"]] === 1)
        {
            removeHiddenParents(currentTree[i]["parentIds"]);
        }
    }
    updateShownNodeMap(treeData);
    drawTree(currentTree,"init");
    if(zoomTransform === undefined)
    {
        zoomTransform = d3.zoomIdentity
    }
    zoomTransform.k = 2.2;
    zoomTransform.x = -2000;
    zoomTransform.y = 2000;
    graph.attr('transform', zoomTransform);
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
  return JSON.parse(allText);
 }

/**
 * Performs action after a node is clicked
 * @param {Object} d clicked info
 */
 function onNodeClicked(d) {
   let currentNodeId = d.currentTarget.__data__.data.id;
   let node = getNodeByTitle(d.currentTarget.__data__.data.title);
   $("#info_box").empty();
   addNodeInfos(node, "preview");
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
      let wordsCopy = [...words];
      // split into lines
      let word;
      let line = [];
      let lineNumber = 0;
      let lineHeight = 1; // ems
      let x = textd3.attr('x');
      let y = textd3.attr('y');
      let dy = 0;
      // Get number of lines before wrapping to adjust the y position of the text
      let tempLine = [];
      let lineCount = 0;
      while (word = wordsCopy.pop()) {
          tempLine.push(word);
          textd3.text(tempLine.join(' '));
          if (textd3.node().getComputedTextLength() > width) {
              tempLine.pop();
              tempLine = [word];
              lineCount++;
          }
      }
      if (tempLine.length > 0) {
          lineCount++;
      }
      y = (nodeHeight - lineCount * 12) / 2;
      word = ""
      // Add tspan elements for each line to wrap text
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
  });
}
/**
 * Performs graph update. Updates nodes and links.
 * @param {String} currentNodeId
 */
 function updateGraphPlot(currentNodeId) {
  currentHighlightedNodeId = currentNodeId;
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
/**
 * Toggle between expanding and collapsing node children
 * @param {Object} d clicked node
 * @param {String} command identify which action should be executed
 */
function onNodeChildrenToggle(d,command){
    let currentNodeId = d.data.id;
    let state;
    if(command === "collapse")
    {
        state = "children collapse";
        nodeChildrenStateMap[currentNodeId] = 0;
    }
    else
    {
        state = "children expand";
        nodeChildrenStateMap[currentNodeId] = 1;
    }
    updateTree(currentNodeId,state);
}

function onNodeParentsToggle(d)
{
    let currentNodeId = d.currentTarget.__data__.data.id;
    let state = "parents expand";
    updateTree(currentNodeId,state);
}
/**
 * update currentTree after expand/collapse of a node
 * @param {String} currentNodeId node ID
 * @param {String} state node to be expanded or collapsed
 */
function updateTree(currentNodeId,state){
    let data = structuredClone(treeData); // A clone is made to avoid any modifications in the original data
    if(state === "children expand")
    {
        nodeChildrenExpand(currentNodeId,data);
    }
    else if(state === "children collapse")
    {
        nodeChildrenCollapse(currentNodeId);
    }
    else if (state === "parents expand")
    {
        nodeParentsExpand(currentNodeId,data);
    }
    for (let i = 0; i < currentTree.length; i++)
    {
        if(shownNodesMap[currentTree[i]["id"]] === 1)
        {
            removeHiddenParents(currentTree[i]["parentIds"]);
        }
    }
    updateShownNodeMap(treeData)
    highlightSelectedNode(currentNodeId);
    updateTreeGraph(currentTree,currentNodeId, state);
}

/**
 * draw the tree elements
 * @param {Array} drawData current tree data
 * @param {String} state initialize or update the tree
 */
function drawTree(drawData,state)
{
    generateTreeLayout(drawData);
    const { width, height } = layout(dag);
    let sizeFactor = width/window.innerWidth
    currentHighlightedNodeId = "-1";

    // --------------------------------
    // This code only handles rendering
    // --------------------------------
    svgSelection = d3.select("svg");
    svgSelection.selectAll('*').remove();
    if(state === "expand tree")
    {
        svgSelection.attr("viewBox", [0, 0, width, (window.innerHeight)*sizeFactor].join(" "));
    }
    else{
        svgSelection.attr("viewBox", [0, 0, viewboxWidth, viewboxHeight].join(" "));
    }
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
        .attr("transform", ({x,y}) => `translate(${x}, ${y})`);
    // Plot nodes
    nodes
        .append("rect")
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("rx", function (d) {
            switch (d.data.nodeType) {
                case "designParameter":
                    return 20;
                case "systemIndependent":
                    return 20;
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
        .attr("y", 30)
        .attr("x", 13)
        .text((d) => d.data.title)
        .call(wrapNodeText, maxTextLength)
        .on("click", onNodeClicked);



    // Add text box for FMCW tag, if the attribute FMCWspecific is true
    nodes.filter(d => d.data.FMCWspecific)
        .append("rect")
        .attr("width", 60)
        .attr("height", 20)
        .attr("stroke-width",1.5)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("x", nodeWidth - 60)
        .attr("y", nodeHeight - 20)
        .style("fill", "lightblue");

    nodes.filter(d => d.data.FMCWspecific)
        .append("text")
        .attr("x", nodeWidth - 60 + 30)
        .attr("y", nodeHeight - 20 + 15)
        .attr("dy", "0.1em")
        .attr("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("FMCW")
        .on("click", onNodeClicked);

    // Filter nodes with no parent to add parents expand/collapse button
    let rootsNodes = nodes.filter(function(node){
        return !nodeParentsStateMap[node.data.id];
    })

    rootsNodes.append("circle")
        .attr("cx", nodeWidth/2)
        .attr("cy", 0)
        .attr("r", 12)
        .on("mouseover", function () { d3.select(this).attr("r", 15); })
        .on("mouseout", function () { d3.select(this).attr("r", 12); })
        .on("click", onNodeParentsToggle);

    rootsNodes.append("text")
        .attr("class", "iText")
        .attr("x", nodeWidth/2 - 9)
        .attr("y",7)
        .html("+")

    // Filter nodes with no children to add expand/collapse button
    let leavesNodes = nodes.filter(function(node){
        return !leavesNodesIds.includes(node.data.id);
    })
    leavesNodes.append("rect")
        .attr("width", 50)
        .attr("height", 20)
        .attr("x", nodeWidth/2- 25)
        .attr("y", nodeHeight - 10)
        .attr("fill",function (d) {
            switch (nodeChildrenStateMap[d.data.id]) {
                case 1:
                    return "darkred";
                default:
                    return "darkblue";
            }
        })
        .attr("stroke-width","0")

    leavesNodes
        .append("rect")
        .attr("width", 25)
        .attr("height", 20)
        .attr("x", nodeWidth/2- 25)
        .attr("y", nodeHeight - 10)
        .attr("class", "node-expand-button")  // Add a class for styling if needed
        .attr("fill",function (d) {
            switch (nodeChildrenStateMap[d.data.id]) {
                case 0:
                case 2:
                    return "darkgreen";
                default:
                    return "grey";
            }
        })
        .on("click", function(event,d){
            if((nodeChildrenStateMap[d.data.id]) === 0 || nodeChildrenStateMap[d.data.id] === 2)
            {
                onNodeChildrenToggle(d,"expand");
            }
        });

    leavesNodes
        .append("rect")
        .attr("width", 25)
        .attr("height", 20)
        .attr("x", nodeWidth/2)
        .attr("y", nodeHeight - 10)
        .attr("class", "node-collapse-button")  // Add a class for styling if needed
        .attr("fill",function (d) {
            switch (nodeChildrenStateMap[d.data.id]) {
                case 1:
                case 2:
                    return "darkred";
                default:
                    return "grey";
            }
        })
        .on("click", function(event,d){
            if( (nodeChildrenStateMap[d.data.id]))
            {
                onNodeChildrenToggle(d,"collapse");
            }
        });

    leavesNodes.append("text")
        .attr("class", "iText")
        .attr("x",function (d) {
            return nodeWidth/2 - 21;
        })
        .attr("y",function (d) {
                    return nodeHeight + 7;
        })
        .html(function (d) {
            return "+";
        })

    leavesNodes.append("text")
        .attr("class", "iText")
        .attr("x",function (d) {
            return nodeWidth/2 + 8;
        })
        .attr("y",function (d) {
            return nodeHeight + 6.5;
        })
        .html(function (d) {
            return "-";
        })

}
/**
 * Search for nodes children and add them to the currentTree
 * @param {String} currentNodeId clicked node ID
 * @param {Array} data tree data
 */
function nodeChildrenExpand(currentNodeId,data)
{
    let nodeChildren = [];
    for(let i = 0;i<data.length;i++)
    {
        if(data[i]["parentIds"].includes(currentNodeId))
        {
            // If the child is already shown, add the parent to it in currentTree
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
            nodeChildren.push(data[i]["id"]);
        }
    }
    // Link new nodes (clicked node children) to their existing children
    linkNewNodes(nodeChildren,data)
}
/**
 * Search for nodes children and remove them from currentTree
 * If there is a child has children, check if it should be removed, or it has other parents in the currentTree
 * @param {String} currentNodeId clicked node ID
 */
function nodeChildrenCollapse(currentNodeId)
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
            nodeChildrenStateMap[currentTree[itr]["id"]] = 0;
            currentTree.splice(itr, 1);
        }
        else{
            itr++;
        }
    }
}

/**
 * Remove node parents not included in the currentTree
 * @param {Array} parents node parents
 */
function removeHiddenParents(parents)
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

/**
 * Update expand/collapse state of node
 * @param {Array} data tree data
 */
function updateShownNodeMap(data)
{
    for (let i = 0; i < currentTree.length; i++) {
        if (getNodeChildren(currentTree[i]["id"], data).length === getNodeChildren(currentTree[i]["id"], currentTree).length) {
            nodeChildrenStateMap[currentTree[i]["id"]] = 1;
        } else if (getNodeChildren(currentTree[i]["id"], currentTree).length > 0 ){
            nodeChildrenStateMap[currentTree[i]["id"]] = 2;
        }
        else{
            nodeChildrenStateMap[currentTree[i]["id"]] = 0;
        }
        if (getNodeParents(currentTree[i]["id"], data).length === getNodeParents(currentTree[i]["id"], currentTree).length) {
            nodeParentsStateMap[currentTree[i]["id"]] = 1;
        } else {
            nodeParentsStateMap[currentTree[i]["id"]] = 0;
        }
    }
}
/**
 * Expand node found by search bar
 * It links the node to its existing parents and expand its children
 * @param {Object} node node
 */
function expandSearchedNodeTree(node)
{
    let data = structuredClone(treeData);// A clone is made to avoid any modifications in the original data
    if(shownNodesMap[node.id] !==1)
    {
        shownNodesMap[node.id] = 1;
        currentTree.push(node);
    }
    let nodeParentsQueue = node.parentIds.slice(0);
    // show node parents till the top layer
    while(nodeParentsQueue.length > 0)
    {
        let parentId = nodeParentsQueue.shift();
        let parent = getNodeById(parentId);
        if(shownNodesMap[parentId] !==1)
        {
            shownNodesMap[parentId] = 1;
            currentTree.push(parent);
        }
        parent.parentIds.forEach(function(elem){
            nodeParentsQueue.push(elem);
        })
    }
    // show node children
    let children = getNodeChildren(node.id,data);
    children.forEach(function(child){
        if(shownNodesMap[child.id] !==1)
        {
            shownNodesMap[child.id] = 1;
            currentTree.push(getNodeById(child.id));
        }
    })
    linkNewNodes(children,data);
    updateTree(node.id,"expand searched node tree")
}


/**
 * Search for nodes parents and add them to the currentTree
 * @param {String} currentNodeId clicked node ID
 * @param {Array} data tree data
 */
function nodeParentsExpand(currentNodeId,data)
{
    let node = getNodeById(currentNodeId);
    let nodeParents = node.parentIds;
    nodeParents.forEach(function(parentId){
        if(shownNodesMap[parentId] === 0)
        {
            currentTree.push(getNodeById(parentId));
            shownNodesMap[parentId] = 1;
            linkNewNodes([parentId],data);

        }
        else // if the parent is already shown, add parent id to the current node only
        {
            for(let k=0;k<currentTree.length;k++)
            {
                if(currentNodeId === currentTree[k]["id"] && !currentTree[k]["parentIds"].includes(parentId))
                {
                    currentTree[k]["parentIds"].push(parentId);
                    break;
                }
            }
        }
    })
}

/**
 * Link new nodes to the current shown nodes (new parents to their existing children or new children to their existing parents)
 * @param {Array} nodes new nodes
 * @param {Array} data tree data
 */
function linkNewNodes(nodes,data)
{
    for(let i = 0;i<nodes.length;i++)
    {
        let nodeGrandChildren = getNodeChildren(nodes[i],data);
        for(let j = 0;j<nodeGrandChildren.length;j++)
        {
            if(shownNodesMap[nodeGrandChildren[j]["id"]] === 1)
            {
                for(let k=0;k<currentTree.length;k++)
                {
                    if(nodeGrandChildren[j]["id"] === currentTree[k]["id"] && !currentTree[k]["parentIds"].includes(nodes[i]))
                    {
                        currentTree[k]["parentIds"].push(nodes[i]);
                    }
                }
            }
        }
    }
}
/**
 * update tree graph with nodes transition effect
 * @param {Array} drawData tree data
 * @param {String} currentNodeId tree data
 * @param {String} state node state
 */
function updateTreeGraph(drawData,currentNodeId,state)
{
    let currentNode = nodes.filter(function(node){
        return node.data.id === currentNodeId;
    })
    let currentX = 0,currentY = 0;
    let currentZoomX = zoomTransform.x;
    let currentZoomY = zoomTransform.y;
    if(currentNode._groups[0].length !== 0 ){
        currentX = currentNode._groups[0][0].__data__.x
        currentY = currentNode._groups[0][0].__data__.y
    }

    graph.select(".paths-list").selectAll("*").remove();
    generateTreeLayout(drawData);
    layout(dag);

    // Remove collapsed nodes before starting the animation
    let collapsedNodes = nodes.filter(function(node){
        return shownNodesMap[node.data.id] === 0;
    })
    collapsedNodes.remove();

    nodes = graph
        .select(".nodes-list")
        .selectAll(".node")
        .data(dag.descendants(), d => d.data.id)

    let searchedNodeX = 0,searchedNodeY = 0;
    if (state === "expand searched node tree")
    {
        let new_nodes = dag.descendants();
        for(let i = 0; i < new_nodes.length; ++i)
        {
            if(new_nodes[i].data.id === currentNodeId)
            {
                searchedNodeX = new_nodes[i].x;
                searchedNodeY = new_nodes[i].y;
            }
        }
    }
    let completeTransitions = 0;
    nodes
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attrTween("transform", function (node) {
            // Your translation function
            let translateFunction = d3.interpolateString(this.getAttribute("transform"), `translate(${node.x}, ${node.y})`);
            // Return the tween function
            return function (t) {
                // Dynamically adjust the viewBox during the transition
                if(state === "expand searched node tree")
                {
                    zoomTransform.x = currentZoomX + (viewboxWidth/2 - currentZoomX - searchedNodeX*zoomTransform.k)*t;
                    zoomTransform.y = currentZoomY + (viewboxHeight/2 - currentZoomY - searchedNodeY*zoomTransform.k)*t;
                }
                else if(node.data.id === currentNodeId)
                {
                    zoomTransform.x = currentZoomX - (node.x - currentX)*t*zoomTransform.k;
                    zoomTransform.y = currentZoomY - (node.y - currentY)*t*zoomTransform.k;
                }
                graph.attr('transform', zoomTransform);
                // Return the interpolated transform value
                return translateFunction(t);
            };
        })
        .on("end", function(){
            completeTransitions++;
            if(completeTransitions===nodes.size())
            {
                drawTree(drawData,"update");
                graph.attr('transform', zoomTransform);
                updateGraphPlot(currentNodeId);
            }
        });
}

/**
 * highlight selected node
 * @param {String} currentNodeId node ID
 */
function highlightSelectedNode(currentNodeId)
{
    let node = nodes.filter(function(node){
        return node.data.id === currentNodeId;
    })
    node.select("rect").style("fill","rgba(255,255,0,0.5)");
}

/**
 * generate tree layout
 * @param {Array} treeData tree data
 */
function generateTreeLayout(treeData)
{
    dag = d3.dagStratify()(treeData);
    layout = d3
        .sugiyama() // base layout
        .decross(d3.decrossTwoLayer().order(d3.twolayerAgg())) // minimize number of crossings
        .nodeSize((node) => [(node ? 3.6 : 0.25) * nodeWidth, 2 * nodeWidth]); // set node size instead of constraining to fit
}

/**
 * modify top layer nodes positions to keep them at the top
 */
function keepTopLayersNodesUp()
{
    let rootsNodesY = 100000;
    let rootsNodesX = [];
    // get roots nodes y-coordinate(the minimum to make it constant for all of them) and x-coordinates
    dag.descendants().forEach(function(node){
        if(node.y<rootsNodesY)
        {
            rootsNodesY = node.y;
        }
        if(rootsNodesIds.includes(node.data.id))
        {
            rootsNodesX.push(node.x);
        }
    })
    rootsNodesX.sort(function(a, b){return a - b});
    let xStep = (rootsNodesX[rootsNodesIds.length - 1] - rootsNodesX[0])/rootsNodesIds.length;//horizontal space between roots nodes
    let i = 0;
    // Set the new coordinates to the roots nodes
    dag.descendants().forEach(function(node){
        if(rootsNodesIds.includes(node.data.id))
        {
            node.y = rootsNodesY;
            node.x = rootsNodesX[0] + i*xStep;
            rootsNodesCoord[node.data.id] = [node.x,node.y]
            i+=1;
        }
    })
    // Set the new coordinates to the roots nodes links
    dag.links().forEach(function(node){
        if(rootsNodesIds.includes(node.source.data.id))
        {
            node.points[0].x = rootsNodesCoord[node.source.data.id][0];
            node.points[0].y = rootsNodesCoord[node.source.data.id][1];
        }
    })
}

function expandTree()
{
    currentTree = structuredClone(treeData);
    for(let i = 0;i<currentTree.length;++i)
    {
        shownNodesMap[currentTree[i]["id"]] = 1;
    }
    updateShownNodeMap(currentTree);
    if(zoomTransform !== undefined)
    {
        zoomTransform.k = 1;
        zoomTransform.x = 0;
        zoomTransform.y = 0;
    }
    drawTree(currentTree,"expand tree");
    graph.attr('transform', zoomTransform);

}

function collapseTree()
{
    currentTree = [];
    shownNodesMap = {};
    leavesNodesIds = [];
    rootsNodesIds = [];
    rootsNodesCoord = {};
    initGraph();
}