import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import Plot, { Figure } from "react-plotly.js";
import * as Plotly from "plotly.js";
import { Subject } from "rxjs";

import { IconSpinner } from "../Icon";
import { OutputPlotProps } from "./types";
import { exhaustMapWithTrailing } from "../../util/exhaustMapWithTrailing";
import {
  getValidPlotTypes,
  isASingleStepAggregationOperation,
} from "../../features/analysis/utils";
import { useResizeObserver } from "../../hooks/useResizeObserver/useResizeObserver";
import { yieldToBrowser } from "../../util/yieldToBrowser";

// ...copy all helper functions and logic from OutputPlot.tsx...

// (For brevity, copy all code from the original OutputPlot up to the export default statement)

const mapLayout = (
  layout: Partial<Plotly.Layout>,
  currentStep: number,
  hideStep: boolean | undefined,
): Partial<Plotly.Layout> => {
  const cloned = JSON.parse(JSON.stringify(layout));
  return {
    ...cloned,
    title: undefined, // remove title since we render it outside of OutputPlot
    shapes: (cloned.shapes ?? []).concat(
      currentStep && !hideStep
        ? [
            {
              type: "line",
              yref: "paper",
              y0: 0,
              y1: 1,
              x0: currentStep,
              x1: currentStep,
              line: {
                color: "grey",
                width: 1.5,
                dash: "dot",
              },
            },
          ]
        : [],
    ),
  };
};

const getLastOperationFromOperationChain = (
  definition: any,
  outputs: Record<string, any[]>,
  axisToUse: "x" | "y",
  index: number,
) => {
  const outputMetricKey = definition?.data?.[index][axisToUse];
  if (!outputMetricKey) {
    return false;
  }
  const currentOutput = outputs[outputMetricKey];
  if (!currentOutput) {
    return false;
  }
  return currentOutput[currentOutput.length - 1];
};

const isAxisAvailable = (
  definition: any,
  index: number,
  axisToUse: "x" | "y",
) => !!definition?.data?.[index]?.[axisToUse];

const doLastOperationTypesMatch = (
  definition: any,
  outputs: Record<string, any[]>,
  index: number,
) => {
  const x = isASingleStepAggregationOperation(
    getLastOperationFromOperationChain(definition, outputs, "x", index),
  );
  const y = isASingleStepAggregationOperation(
    getLastOperationFromOperationChain(definition, outputs, "y", index),
  );
  return x === y;
};

const prepareDataBasedOnOutputMetricsLastOperation = async (
  definition: any,
  outputs: Record<string, any[]>,
  clonedData: any,
  currentStep: number,
) => {
  const result = JSON.parse(JSON.stringify(clonedData));
  if (!definition.type) {
    return result;
  }
  if (!getValidPlotTypes().includes(definition.type)) {
    return result;
  }
  switch (definition.type) {
    case "bar": {
      for (let index = 0; index < clonedData.length; index++) {
        const item = clonedData[index];
        const yAxisAvailable = isAxisAvailable(definition, index, "y");
        if (!yAxisAvailable) {
          continue;
        }
        const output = definition?.data?.[index];
        result[index].y = [item.y[currentStep - 1]];
        result[index].x = [output.name ?? output.y];
        await yieldToBrowser();
      }
      break;
    }
    case "box": {
      for (let index = 0; index < clonedData.length; index++) {
        const xAxisAvailable = isAxisAvailable(definition, index, "x");
        const yAxisAvailable = isAxisAvailable(definition, index, "y");
        const lastOp = getLastOperationFromOperationChain(
          definition,
          outputs,
          "y",
          index,
        );
        const lastYOperationIsAnAggregationOperation =
          isASingleStepAggregationOperation(lastOp);
        if (!yAxisAvailable || xAxisAvailable) {
          continue;
        }
        result[index].name =
          definition?.data?.[index].name ?? definition?.data?.[index].y;
        if (lastYOperationIsAnAggregationOperation) {
          result[index].y = clonedData[index].y.slice(0, currentStep);
        }
        if (lastOp.op === "get") {
          result[index].y = clonedData[index].y[currentStep - 1];
        }
        await yieldToBrowser();
      }
      break;
    }
    case "histogram": {
      for (let index = 0; index < clonedData.length; index++) {
        const xAxisAvailable = isAxisAvailable(definition, index, "x");
        const yAxisAvailable = isAxisAvailable(definition, index, "y");
        if (xAxisAvailable && yAxisAvailable) {
          continue;
        }
        const axisToUse = xAxisAvailable ? "x" : "y";
        const lastOperation = getLastOperationFromOperationChain(
          definition,
          outputs,
          axisToUse,
          index,
        );
        if (!lastOperation) {
          continue;
        }
        result[index].name =
          definition?.data?.[index]?.name ??
          definition?.data?.[index][axisToUse];
        if (lastOperation.op === "get") {
          const theCurrentStep = clonedData[index][axisToUse][currentStep - 1];
          if (
            theCurrentStep &&
            Array.isArray(theCurrentStep) &&
            theCurrentStep[0]
          ) {
            result[index][axisToUse] =
              clonedData[index][axisToUse][currentStep - 1][0];
          } else {
            result[index][axisToUse] =
              clonedData[index][axisToUse][currentStep - 1];
          }
        } else {
          result[index][axisToUse] = clonedData[index][axisToUse].slice(
            0,
            currentStep,
          );
        }
        await yieldToBrowser();
      }
      break;
    }
    case "line":
    case "scatter": {
      for (let index = 0; index < clonedData.length; index++) {
        const xAxisAvailable = isAxisAvailable(definition, index, "x");
        const yAxisAvailable = isAxisAvailable(definition, index, "y");
        const lastOperationsTypesAreMatching = doLastOperationTypesMatch(
          definition,
          outputs,
          index,
        );
        const lastXOperationIsAnAggregationOperation =
          isASingleStepAggregationOperation(
            getLastOperationFromOperationChain(definition, outputs, "x", index),
          );
        result[index].type = "scatter";
        result[index].mode =
          definition.type === "scatter" ? "markers" : "lines";
        if (
          xAxisAvailable &&
          yAxisAvailable &&
          lastOperationsTypesAreMatching
        ) {
          if (!lastXOperationIsAnAggregationOperation) {
            result[index].x = clonedData[index].x[currentStep - 1];
            result[index].y = clonedData[index].y[currentStep - 1];
          } else {
            result[index].x = clonedData[index].x.slice(0, currentStep);
            result[index].y = clonedData[index].y.slice(0, currentStep);
          }
        }
        if (
          !xAxisAvailable &&
          yAxisAvailable &&
          lastXOperationIsAnAggregationOperation
        ) {
          result[index].y = clonedData[index].y.slice(0, currentStep);
        }
        await yieldToBrowser();
      }
      break;
    }
  }
  return result;
};

const usePreparePlotsObserver = (
  definition: any,
  outputs: Record<string, any[]>,
  clonedData: any,
  currentStep: number,
) => {
  const ref = useRef<
    Subject<{
      definition: any;
      outputs: Record<string, any[]>;
      clonedData: any;
      currentStep: number;
    }>
  >(null as any);
  const [result, setResult] = useState<any>(null);

  if (!ref.current) {
    ref.current = new Subject();
  }

  useEffect(() => {
    const subscription = ref.current
      .pipe(
        exhaustMapWithTrailing((obj) =>
          prepareDataBasedOnOutputMetricsLastOperation(
            obj.definition,
            obj.outputs,
            obj.clonedData,
            obj.currentStep,
          ),
        ),
      )
      .subscribe((result) => {
        setResult(result);
      });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    ref.current.next({ definition, outputs, clonedData, currentStep });
  }, [definition, outputs, clonedData, currentStep]);

  return result;
};

const PlotlyPlot: FC<
  Omit<OutputPlotProps, "key"> & {
    currentStep: number;
    readonly: boolean;
    onEdit?: VoidFunction;
  }
> = ({
  data,
  layout,
  config,
  currentStep,
  hideStep,
  outputs,
  definition,
  readonly,
  onEdit,
}) => {
  const [plotlyConfig, setPlotlyConfig] = useState(() =>
    JSON.parse(JSON.stringify(config)),
  );
  const [plotlyLayout, setPlotlyLayout] = useState(
    mapLayout({ ...layout, title: undefined }, currentStep, hideStep),
  );

  const clonedData = useMemo(() => JSON.parse(JSON.stringify(data)), [data]);

  const plotlyRef = useRef<Plot>(null);
  const resizeRef = useResizeObserver(
    () => {
      (plotlyRef.current as any)?.resizeHandler?.();
    },
    {
      onObserve: null,
    },
  );

  useEffect(() => {
    setPlotlyLayout(
      mapLayout({ ...layout, title: undefined }, currentStep, hideStep),
    );
  }, [currentStep, hideStep, layout]);

  useEffect(() => {
    setPlotlyConfig(JSON.parse(JSON.stringify(config)));
  }, [config]);

  const [loading, setLoading] = useState(true);
  const preparedData = usePreparePlotsObserver(
    definition,
    outputs ?? {},
    clonedData,
    currentStep,
  );

  return (
    <>
      <h3 className="PlotViewer__Plots__PlotTitle">
        {definition.title} {readonly ? null : <button onClick={onEdit}>(Edit)</button>} {loading ? <IconSpinner size={16} /> : null}
      </h3>
      <div ref={resizeRef}>
        <Plot
          ref={plotlyRef}
          data={preparedData}
          config={plotlyConfig}
          layout={plotlyLayout}
          onAfterPlot={() => {
            setLoading(false);
          }}
          onInitialized={({ layout }: Readonly<Figure>) =>
            setPlotlyLayout(layout)
          }
          onUpdate={({ layout }: Readonly<Figure>) => setPlotlyLayout(layout)}
          useResizeHandler={true}
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      </div>
    </>
  );
};

export default PlotlyPlot; 