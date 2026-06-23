//! Actor state management utilities.

use std::sync::Arc;
use tokio::sync::RwLock;

/// Trait for actor state that can be read and written atomically.
pub trait ActorState: Send + Sync {
    type Snapshot;

    /// Create a snapshot of the current state for monitoring/debugging.
    fn snapshot(&self) -> Self::Snapshot;
}

/// Wrapper for thread-safe state access with RwLock.
#[derive(Debug)]
#[allow(dead_code)]
pub struct SharedState<T> {
    inner: Arc<RwLock<T>>,
}

#[allow(dead_code)]
impl<T> SharedState<T> {
    pub fn new(value: T) -> Self {
        Self {
            inner: Arc::new(RwLock::new(value)),
        }
    }

    pub async fn read(&self) -> tokio::sync::RwLockReadGuard<'_, T> {
        self.inner.read().await
    }

    pub async fn write(&self) -> tokio::sync::RwLockWriteGuard<'_, T> {
        self.inner.write().await
    }

    pub fn into_arc(self) -> Arc<RwLock<T>> {
        self.inner
    }

    pub fn as_arc(&self) -> Arc<RwLock<T>> {
        Arc::clone(&self.inner)
    }
}

#[allow(dead_code)]
impl<T: Clone> SharedState<T> {
    /// Get a cloned copy of the current state (non-await).
    pub fn get_cloned(&self) -> T
    where
        T: Clone,
    {
        // This would need a blocking read, so we use try_read
        // For non-blocking usage, prefer the async methods
        self.inner.blocking_read().clone()
    }
}

impl<T: Default> Default for SharedState<T> {
    fn default() -> Self {
        Self::new(T::default())
    }
}

impl<T> Clone for SharedState<T> {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}
