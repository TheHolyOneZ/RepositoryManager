use crate::models::{OperationLog, AppError};

#[tauri::command]
pub async fn logs_get(_limit: u32, _offset: u32) -> Result<Vec<OperationLog>, AppError> {

    Ok(vec![])
}
