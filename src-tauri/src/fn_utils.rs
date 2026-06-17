//! Functional utilities for reactive, functional Rust code.
//!
//! This module provides utility functions and types for functional programming
//! patterns: Option/Result chaining, pipeline operators, and async helpers.

use std::future::Future;
use tokio::time::Duration;

/// Extension trait for Option<T> with functional methods.
pub trait OptionExt<T> {
    /// Map the value if present, otherwise return a default.
    fn map_or_else<F, U>(&self, default: U, f: F) -> U
    where
        F: FnOnce(&T) -> U;

    /// Filter the option, returning None if the predicate fails.
    fn filter<P>(&self, predicate: P) -> Option<&T>
    where
        P: FnOnce(&T) -> bool;

    /// Convert Option<T> to Result<T, E>.
    fn ok_or_err<E>(&self, err: E) -> Result<&T, E>;

    /// Apply a fallible function to the value.
    fn and_then_try<F, U, E>(&self, f: F) -> Result<Option<U>, E>
    where
        F: FnOnce(&T) -> Result<U, E>;

    /// Chain a fallible operation if the option is Some.
    fn try_fold<A, F, B, E>(&self, init: A, f: F) -> Result<Option<B>, E>
    where
        F: FnMut(A, &T) -> Result<B, E>;
}

impl<T> OptionExt<T> for Option<T> {
    fn map_or_else<F, U>(&self, default: U, f: F) -> U
    where
        F: FnOnce(&T) -> U,
    {
        match self {
            Some(v) => f(v),
            None => default,
        }
    }

    fn filter<P>(&self, predicate: P) -> Option<&T>
    where
        P: FnOnce(&T) -> bool,
    {
        match self {
            Some(v) if predicate(v) => Some(v),
            _ => None,
        }
    }

    fn ok_or_err<E>(&self, err: E) -> Result<&T, E> {
        match self {
            Some(v) => Ok(v),
            None => Err(err),
        }
    }

    fn and_then_try<F, U, E>(&self, f: F) -> Result<Option<U>, E>
    where
        F: FnOnce(&T) -> Result<U, E>,
    {
        match self {
            Some(v) => f(v).map(Some),
            None => Ok(None),
        }
    }

    fn try_fold<A, F, B, E>(&self, init: A, mut f: F) -> Result<Option<B>, E>
    where
        F: FnMut(A, &T) -> Result<B, E>,
    {
        match self {
            Some(v) => f(init, v).map(Some),
            None => Ok(None),
        }
    }
}

/// Extension trait for Result<T, E> with functional methods.
pub trait ResultExt<T, E> {
    /// Map the Ok value, passing through the error.
    fn map_err_into<F>(self, f: F) -> Result<T, String>
    where
        F: FnOnce(E) -> String;

    /// Convert error to a different type.
    fn map_err_to_string(self) -> Result<T, String>
    where
        E: std::fmt::Display;

    /// Flatten nested results.
    fn flatten_ok<Err>(self) -> Result<T, Err>
    where
        E: Into<Err>;

    /// Get the Ok value or a default.
    fn unwrap_or_default(self) -> T
    where
        T: Default;
}

impl<T, E> ResultExt<T, E> for Result<T, E> {
    fn map_err_into<F>(self, f: F) -> Result<T, String>
    where
        F: FnOnce(E) -> String,
    {
        self.map_err(f)
    }

    fn map_err_to_string(self) -> Result<T, String>
    where
        E: std::fmt::Display,
    {
        self.map_err(|e| e.to_string())
    }

    fn flatten_ok<Err>(self) -> Result<T, Err>
    where
        E: Into<Err>,
    {
        self.map_err(Into::into)
    }

    fn unwrap_or_default(self) -> T
    where
        T: Default,
    {
        self.unwrap_or_default()
    }
}

/// Extension trait for Iterator with functional methods.
pub trait IteratorExt<T> {
    /// Filter map with a fallible function.
    fn filter_map_try<F, U, E>(self, f: F) -> Result<Vec<U>, E>
    where
        F: FnMut(T) -> Result<Option<U>, E>,
        Self: Sized + Iterator<Item = T>;
}

impl<T, I> IteratorExt<T> for I
where
    I: Iterator<Item = T>,
{
    fn filter_map_try<F, U, E>(self, mut f: F) -> Result<Vec<U>, E>
    where
        F: FnMut(T) -> Result<Option<U>, E>,
        Self: Sized + Iterator<Item = T>,
    {
        let mut result = Vec::new();
        for item in self {
            if let Some(u) = f(item)? {
                result.push(u);
            }
        }
        Ok(result)
    }
}

/// Collect items into a Result, failing on the first error.
pub fn collect_result<T, E, I>(iter: I) -> Result<Vec<T>, E>
where
    E: Clone,
    I: IntoIterator<Item = Result<T, E>>,
{
    let mut result = Vec::new();
    for item in iter {
        result.push(item?);
    }
    Ok(result)
}

/// Extension trait for Vec<T> with functional methods.
pub trait VecExt<T> {
    /// Find the first item matching a predicate.
    fn find_first<P>(&self, predicate: P) -> Option<&T>
    where
        P: Fn(&T) -> bool;

    /// Apply a function to each item, collecting results.
    fn map_collect<U, F>(&self, f: F) -> Vec<U>
    where
        F: Fn(&T) -> U;
}

impl<T> VecExt<T> for Vec<T> {
    fn find_first<P>(&self, predicate: P) -> Option<&T>
    where
        P: Fn(&T) -> bool,
    {
        self.iter().find(|item| predicate(item))
    }

    fn map_collect<U, F>(&self, f: F) -> Vec<U>
    where
        F: Fn(&T) -> U,
    {
        self.iter().map(f).collect()
    }
}

/// Partition a Vec of Results into (successes, failures).
pub fn partition_results<T, E>(vec: Vec<Result<T, E>>) -> (Vec<T>, Vec<E>) {
    let mut ok_vec = Vec::new();
    let mut err_vec = Vec::new();
    for item in vec {
        match item {
            Ok(v) => ok_vec.push(v),
            Err(e) => err_vec.push(e),
        }
    }
    (ok_vec, err_vec)
}

/// Extension trait for String with functional methods.
pub trait StringExt {
    /// Trim and convert empty strings to None.
    fn non_empty(&self) -> Option<&str>;

    /// Check if the string is a placeholder value.
    fn is_placeholder(&self) -> bool;

    /// Mask the string for logging (show first and last few chars).
    fn masked(&self) -> String;
}

impl StringExt for String {
    fn non_empty(&self) -> Option<&str> {
        let trimmed = self.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    }

    fn is_placeholder(&self) -> bool {
        matches!(
            self.as_str(),
            "your_client_id_here" | "your_client_secret_here" | ""
        )
    }

    fn masked(&self) -> String {
        if self.len() <= 8 {
            "*".repeat(self.len())
        } else {
            format!(
                "{}...{}",
                &self[..3],
                &self[self.len() - 3..]
            )
        }
    }
}

/// Pipeline operator: `value.pipe(f)` is equivalent to `f(value)`.
pub trait Pipe<T> {
    fn pipe<F, R>(self, f: F) -> R
    where
        F: FnOnce(T) -> R;
}

impl<T> Pipe<T> for T {
    fn pipe<F, R>(self, f: F) -> R
    where
        F: FnOnce(T) -> R,
    {
        f(self)
    }
}

/// Async extension trait for std::time::Duration.
pub trait DurationExt {
    /// Create a Duration from seconds.
    fn secs(s: u64) -> Duration;
    
    /// Create a Duration from milliseconds.
    fn millis(ms: u64) -> Duration;
    
    /// Create a Duration from minutes.
    fn mins(m: u64) -> Duration;
}

impl DurationExt for Duration {
    fn secs(s: u64) -> Duration {
        Duration::from_secs(s)
    }
    
    fn millis(ms: u64) -> Duration {
        Duration::from_millis(ms)
    }
    
    fn mins(m: u64) -> Duration {
        Duration::from_secs(m * 60)
    }
}

/// Async retry with exponential backoff.
pub async fn retry_with_backoff<F, Fut, T>(
    mut f: F,
    max_retries: u32,
    initial_delay: Duration,
) -> Result<T, String>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, String>>,
{
    let mut delay = initial_delay;
    let mut last_error = String::new();

    for attempt in 0.. {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                last_error = e;
                if attempt >= max_retries {
                    break;
                }
                tokio::time::sleep(delay).await;
                delay *= 2;
            }
        }
    }

    Err(format!(
        "Failed after {} retries: {}",
        max_retries + 1,
        last_error
    ))
}

/// Timeout wrapper that adds context to errors.
pub async fn with_timeout<T>(
    dur: Duration,
    future: impl Future<Output = Result<T, String>>,
) -> Result<T, String> {
    tokio::time::timeout(dur, future)
        .await
        .map_err(|_| format!("Operation timed out after {:?}", dur))?
        .map_err_to_string()
}

/// A simple sleep utility that wraps tokio::time::sleep.
pub async fn sleep(duration: Duration) {
    tokio::time::sleep(duration).await;
}

/// Sleep for a given number of milliseconds.
pub async fn sleep_ms(ms: u64) {
    tokio::time::sleep(Duration::from_millis(ms)).await;
}

/// Extension trait for std::collections::HashMap.
pub trait HashMapExt<K, V> {
    /// Get a value or insert a default.
    fn get_or_insert<F>(&mut self, key: K, default: F) -> &mut V
    where
        F: FnOnce() -> V,
        K: std::hash::Hash + Eq + Clone;

    /// Update a value using a function.
    fn update<F>(&mut self, key: K, f: F)
    where
        F: FnOnce(Option<V>) -> V,
        K: std::hash::Hash + Eq + Clone;
}

impl<K, V> HashMapExt<K, V> for std::collections::HashMap<K, V>
where
    K: std::hash::Hash + Eq + Clone,
{
    fn get_or_insert<F>(&mut self, key: K, default: F) -> &mut V
    where
        F: FnOnce() -> V,
    {
        if !self.contains_key(&key) {
            self.insert(key.clone(), default());
        }
        self.get_mut(&key).expect("Key was just inserted")
    }

    fn update<F>(&mut self, key: K, f: F)
    where
        F: FnOnce(Option<V>) -> V,
    {
        let value = f(self.remove(&key));
        self.insert(key, value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_option_filter() {
        let x: Option<i32> = Some(4);
        assert_eq!(x.filter(|x| *x > 2), Some(4));
        assert_eq!(x.filter(|x| *x > 5), None);
    }

    #[test]
    fn test_string_masked() {
        let short = String::from("short");
        assert_eq!(short.masked(), "*****");
        
        let long = String::from("longpassword");
        assert_eq!(long.masked(), "lon...ord");
        
        let verylong = String::from("verylongtoken12345");
        assert_eq!(verylong.masked(), "ver...345");
    }

    #[test]
    fn test_pipe() {
        let x = 5;
        let result = x.pipe(|v| v * 2).pipe(|v| v + 1);
        assert_eq!(result, 11);
    }

    #[test]
    fn test_partition_results() {
        let inputs: Vec<Result<i32, &str>> = vec![Ok(1), Err("a"), Ok(2), Err("b")];
        let (oks, errs) = partition_results(inputs);
        assert_eq!(oks, vec![1, 2]);
        assert_eq!(errs, vec!["a", "b"]);
    }
}
