use hashintel_core::prelude::*;
use wasm_bindgen::prelude::*;
use serde_wasm_bindgen::to_value;

#[wasm_bindgen]
pub struct ContextWrapper {
    messages_values: JsValue,
    neighbor_ids: Vec<String>,
}

impl ContextWrapper {
    pub fn new(context: &Context) -> SimulationResult<ContextWrapper> {
        // we do not store properties in this wrapper because the JS side already has them
        let js_messages = to_value(&context.messages).map_err(|e| SimulationError::from(e.to_string()))?;
        let neighbor_ids = context
            .neighbors
            .iter()
            .map(|a| a.agent_id.clone())
            .collect::<Vec<String>>();

        Ok(ContextWrapper {
            messages_values: js_messages,
            neighbor_ids,
        })
    }
}

#[wasm_bindgen]
impl ContextWrapper {
    #[wasm_bindgen]
    pub fn neighbors(&self) -> Result<JsValue, JsValue> {
        to_value(&self.neighbor_ids).map_err(|e| JsValue::from(e.to_string()))
    }

    #[wasm_bindgen]
    pub fn messages(&self) -> Result<JsValue, JsValue> {
        Ok(self.messages_values.clone())
    }
}
