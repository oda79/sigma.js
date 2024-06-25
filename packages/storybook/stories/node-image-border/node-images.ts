import { createNodeImageBorderProgram  } from "@sigma/node-image-border";
import Graph from "graphology";
import Sigma from "sigma";

import { onStoryDown } from "../utils";

export default () => {
  const container = document.getElementById("sigma-container") as HTMLElement;

  const graph = new Graph();

  graph.addNode("a", {
    x: 0,
    y: 0,
    size: 20,
    color: "green",
    borderColor: "blue",  
    alpha: 0.5,
    image: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Jim_Morrison_1969.JPG",
  });
  graph.addNode("b", {
    x: 1,
    y: -1,
    size: 40,
    color: "red",
    borderColor: "blue",    
    alpha: 0.3,
    image: "",
  });
  graph.addNode("c", {
    x: 3,
    y: -2,
    size: 40,
    color: "green",
    borderColor: "blue",
    pictoColor: "red",
    image: "https://upload.wikimedia.org/wikipedia/commons/6/6c/Jimi-Hendrix-1967-Helsinki-d.jpg",
  });
  graph.addNode("d", {
    type: 'pict',
    x: 1,
    y: -3,
    size: 40,
    color: "green",
    borderColor: "blue",
    pictoColor: "red",
    alpha: 0.5,    
    image: "https://icons.getbootstrap.com/assets/icons/person.svg",
  });
  graph.addNode("e", {
    type: 'image-padding',
    x: 3,
    y: -4,
    size: 60,
    borderColor: "red",
    alpha: 0.7,
    image: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Eric_Clapton_1.jpg",
  });
  graph.addNode("f", {
    x: 4,
    y: -5,
    size: 40,
    color: "red",
    borderColor: "blue",        
    image: "https://upload.wikimedia.org/wikipedia/commons/6/66/Mick-Jagger-1965b.jpg",
  });

  graph.addEdge("a", "b", { size: 10 });
  graph.addEdge("b", "c", { size: 10 });
  graph.addEdge("b", "d", { size: 10 });
  graph.addEdge("c", "b", { size: 10 });
  graph.addEdge("c", "e", { size: 10 });
  graph.addEdge("d", "c", { size: 10 });
  graph.addEdge("d", "e", { size: 10 });
  graph.addEdge("e", "d", { size: 10 });
  graph.addEdge("f", "e", { size: 10 });

  const renderer = new Sigma(graph, container, {
    defaultNodeType: "image",    
    nodeProgramClasses: {
      image: createNodeImageBorderProgram({ 
        border: { size: { value: 5, mode: "pixels" }, color: { attribute: "borderColor" } },  
        padding: 0
      }),
      'image-padding': createNodeImageBorderProgram({ 
        border: { size: { value: 5, mode: "pixels" }, color: { attribute: "borderColor" } },  
        padding: 0.4
      }),      
      pict: createNodeImageBorderProgram({
        border: { size: { value: 10, mode: "pixels" }, color: { attribute: "borderColor" } },
        size: { mode: "force", value: 512 },        
        drawingMode: "color",
        padding: 0.4,
        colorAttribute: "pictoColor",        
      })      
    }
  })

  onStoryDown(() => {
    renderer.kill();
  });
};
