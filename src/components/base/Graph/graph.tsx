import React, {useEffect} from 'react';
import Style from './graph.module.css'
import renderGraph from "../../../core/view/graph/graph";
import {easyTestData, testData} from "./test-data";
import {RhineBlock} from "../../../core/RhineBlock";
import MellowRender from "../../../core/render/mellow/mellow-render";

let initialized = false;

export default function Graph(props: any) {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && !initialized) {
      RhineBlock.setRender(MellowRender);
      const graph = renderGraph(ref.current, testData);
      initialized = true;
    }
  }, [])

  return (
    <div className={Style.holder} ref={ref}>
    </div>
  )
}
