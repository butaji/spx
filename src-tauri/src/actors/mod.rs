//! Actor framework for event-driven state management.
//!
//! This module provides a simple actor model where:
//! - Actors hold state and process messages sequentially
//! - Each actor has a mailbox for receiving messages
//! - Responses are sent back via oneshot channels
//!
//! # Architecture
//!
//! ```text
//! WebSocket ──message──► ActorRef ──enqueue──► Mailbox
//!                         ▲                      │
//!                         │                      ▼
//!                    ActorRef               Handler processes
//!                         ▲                      │
//!                         │                      ▼
//!                    Response ◄──oneshot──┘
//! ```
//!
//! # Components
//!
//! - [`Message`] - Trait for messages that can be handled by actors
//! - [`Handler`] - Trait for types that process messages
//! - [`Actor`] - Combines a handler with a mailbox for message processing
//! - [`Mailbox`] - Channel-based message queue
//! - [`SharedState`] - Thread-safe state management with RwLock
//!
//! # Tests
//!
//! Comprehensive tests are available in the [`tests`] module.

mod handler;
mod mailbox;
mod state;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod spotify_tests;

// Note: spotify_tests.rs has pre-existing compilation issues (temporary borrowing bugs, 
// Result handling issues). To enable, fix the issues in src-tauri/src/actors/spotify_tests.rs:
// - Change `actor.state().read().await` to `let state = actor.state(); state.read().await`
// - Fix Result::unwrap_err() usage (call .as_ref() before .contains())
// - Fix futures::future::join_all() to properly unwrap JoinError results
// #[cfg(test)]
// mod spotify_tests;

pub use handler::{Actor, ActorRef, Handler, Message};
pub use mailbox::Mailbox;
pub use state::ActorState;

// Re-export concrete implementations
pub mod spotify;
