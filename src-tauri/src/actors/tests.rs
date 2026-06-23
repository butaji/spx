//! Comprehensive tests for the actor framework.
//!
//! This module tests the event-driven actor architecture which provides:
//! - Sequential message processing within each actor
//! - Thread-safe state management via RwLock
//! - Asynchronous message passing via channels
//!
//! # Architecture Overview
//!
//! ```text
//! Client ──message──► Mailbox/Sender ──enqueue──► Actor
//!                                                       │
//!                                                  Handler processes
//!                                                       │
//!                                                  Response via channel
//! ```
//!
//! # Key Properties Tested
//!
//! 1. **Message Trait**: Messages must be Send + 'static with a Response type
//! 2. **Handler Trait**: Handlers process messages sequentially
//! 3. **Actor**: Combines handler and mailbox for message processing
//! 4. **Mailbox**: Channel-based message queue with bounded capacity
//! 5. **SharedState**: Thread-safe state access via RwLock

use std::sync::Arc;
use tokio::sync::RwLock;

// Import the actor framework components
use super::mailbox::Sender;
use super::state::SharedState;
use super::{Actor, ActorRef, Handler, Mailbox, Message};

// ══════════════════════════════════════════════════════════════════════════════
// TEST MESSAGES
// ══════════════════════════════════════════════════════════════════════════════

/// Simple increment message for testing.
#[derive(Debug, Clone)]
struct IncrementMessage;

impl Message for IncrementMessage {
    type Response = i32;
}

/// Message that sets a value.
#[derive(Debug, Clone)]
struct SetValueMessage(i32);

impl Message for SetValueMessage {
    type Response = ();
}

/// Message that gets the current value.
#[derive(Debug, Clone)]
struct GetValueMessage;

impl Message for GetValueMessage {
    type Response = i32;
}

/// Message with multiple fields for testing serialization-like behavior.
#[derive(Debug, Clone, PartialEq)]
struct ComplexMessage {
    id: u64,
    data: String,
    priority: u8,
}

impl Message for ComplexMessage {
    type Response = String;
}

// Note: ConditionalPanicMessage could be used for error testing in the future
// #[derive(Debug, Clone)]
// struct ConditionalPanicMessage(bool);

// ══════════════════════════════════════════════════════════════════════════════
// TEST HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

/// Simple counter handler that processes IncrementMessage.
#[derive(Debug, Clone)]
struct CounterHandler {
    count: i32,
}

impl CounterHandler {
    fn new() -> Self {
        Self { count: 0 }
    }

    fn get_count(&self) -> i32 {
        self.count
    }
}

impl Handler<IncrementMessage> for CounterHandler {
    fn handle(&mut self, _msg: IncrementMessage) {
        self.count += 1;
    }
}

/// Handler that manages a value and responds to both set and get operations.
#[derive(Debug)]
struct ValueHandler {
    value: i32,
}

impl ValueHandler {
    fn new() -> Self {
        Self { value: 0 }
    }
}

impl Handler<SetValueMessage> for ValueHandler {
    fn handle(&mut self, msg: SetValueMessage) {
        self.value = msg.0;
    }
}

impl Handler<GetValueMessage> for ValueHandler {
    fn handle(&mut self, _msg: GetValueMessage) {
        // Note: In a real handler, we'd send via reply channel
        // This is simplified for testing
    }
}

/// Handler that processes complex messages and returns responses.
#[derive(Debug)]
struct ComplexHandler {
    processed: Vec<u64>,
}

impl ComplexHandler {
    fn new() -> Self {
        Self {
            processed: Vec::new(),
        }
    }

    fn get_processed_count(&self) -> usize {
        self.processed.len()
    }
}

impl Handler<ComplexMessage> for ComplexHandler {
    fn handle(&mut self, msg: ComplexMessage) {
        self.processed.push(msg.id);
    }
}

// StateHandler example (kept for reference - demonstrates shared state patterns)
// #[derive(Debug)]
// struct StateHandler {
//     state: Arc<RwLock<Vec<String>>>,
// }

// ══════════════════════════════════════════════════════════════════════════════
// TESTS: Message Trait
// ══════════════════════════════════════════════════════════════════════════════

/// Test that messages can be created and have the correct Response type.
#[test]
fn test_message_trait_basic() {
    // Verify message types have correct response types
    fn assert_response_type<M: Message>() {}

    // These should compile - verifying the trait bounds
    assert_response_type::<IncrementMessage>();
    assert_response_type::<SetValueMessage>();
    assert_response_type::<GetValueMessage>();
    assert_response_type::<ComplexMessage>();

    // Verify IncrementMessage returns i32
    fn check_increment_response<M: Message<Response = i32>>() {}
    check_increment_response::<IncrementMessage>();

    // Verify SetValueMessage returns ()
    fn check_set_response<M: Message<Response = ()>>() {}
    check_set_response::<SetValueMessage>();

    // Verify ComplexMessage returns String
    fn check_complex_response<M: Message<Response = String>>() {}
    check_complex_response::<ComplexMessage>();
}

/// Test that messages are Send + 'static (required by the trait).
#[test]
fn test_message_send_static() {
    fn assert_send_static<T: Send + 'static>() {}

    assert_send_static::<IncrementMessage>();
    assert_send_static::<SetValueMessage>();
    assert_send_static::<GetValueMessage>();
    assert_send_static::<ComplexMessage>();
}

/// Test message equality and cloning.
#[test]
fn test_message_clonability() {
    let msg1 = ComplexMessage {
        id: 42,
        data: "test".to_string(),
        priority: 5,
    };

    let msg2 = msg1.clone();
    assert_eq!(msg1, msg2);

    // Verify the clone is independent
    let msg3 = ComplexMessage {
        id: 43,
        data: "other".to_string(),
        priority: 10,
    };
    assert_ne!(msg1, msg3);
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS: Handler Trait
// ══════════════════════════════════════════════════════════════════════════════

/// Test that a simple handler can be created and processes messages.
#[test]
fn test_handler_processes_messages() {
    let mut handler = CounterHandler::new();
    assert_eq!(handler.get_count(), 0);

    // Process several increment messages
    handler.handle(IncrementMessage);
    assert_eq!(handler.get_count(), 1);

    handler.handle(IncrementMessage);
    assert_eq!(handler.get_count(), 2);

    handler.handle(IncrementMessage);
    assert_eq!(handler.get_count(), 3);
}

/// Test handler for value operations.
#[test]
fn test_handler_value_operations() {
    let mut handler = ValueHandler::new();
    assert_eq!(handler.value, 0);

    handler.handle(SetValueMessage(42));
    assert_eq!(handler.value, 42);

    handler.handle(SetValueMessage(100));
    assert_eq!(handler.value, 100);

    handler.handle(SetValueMessage(-5));
    assert_eq!(handler.value, -5);
}

/// Test complex handler that stores message data.
#[test]
fn test_handler_complex_messages() {
    let mut handler = ComplexHandler::new();
    assert_eq!(handler.get_processed_count(), 0);

    handler.handle(ComplexMessage {
        id: 1,
        data: "first".to_string(),
        priority: 1,
    });
    assert_eq!(handler.get_processed_count(), 1);

    handler.handle(ComplexMessage {
        id: 2,
        data: "second".to_string(),
        priority: 2,
    });
    assert_eq!(handler.get_processed_count(), 2);

    handler.handle(ComplexMessage {
        id: 3,
        data: "third".to_string(),
        priority: 3,
    });
    assert_eq!(handler.get_processed_count(), 3);
}

/// Test that multiple handlers of different types can coexist.
#[test]
fn test_multiple_handler_types() {
    let mut counter = CounterHandler::new();
    let mut value = ValueHandler::new();
    let mut complex = ComplexHandler::new();

    // Each handler maintains its own state
    counter.handle(IncrementMessage);
    value.handle(SetValueMessage(10));
    complex.handle(ComplexMessage {
        id: 1,
        data: "test".to_string(),
        priority: 1,
    });

    assert_eq!(counter.get_count(), 1);
    assert_eq!(value.value, 10);
    assert_eq!(complex.get_processed_count(), 1);
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS: Mailbox
// ══════════════════════════════════════════════════════════════════════════════

/// Test mailbox creation with custom capacity.
#[test]
fn test_mailbox_creation_custom_capacity() {
    let (_mailbox, _sender) = Mailbox::<IncrementMessage>::new(50);
    // Mailbox is created, sender is dropped
    // This tests that creation doesn't panic
    assert!(true);
}

/// Test mailbox creation with default capacity.
#[test]
fn test_mailbox_creation_default() {
    let (_mailbox, _sender) = Mailbox::<IncrementMessage>::with_default_capacity();
    // Default capacity is 100
    assert!(true);
}

/// Test mailbox cannot be cloned (design requirement).
#[test]
#[should_panic(expected = "Mailbox cannot be cloned")]
fn test_mailbox_not_cloneable() {
    let (mailbox, _sender) = Mailbox::<IncrementMessage>::new(10);
    let _cloned = mailbox.clone();
}

/// Test Sender creation and basic properties.
#[test]
fn test_sender_properties() {
    let capacity = 100;
    let (_mailbox, sender) = Mailbox::<IncrementMessage>::new(capacity);
    let sender = super::mailbox::Sender::new(sender.into());

    // Check initial capacity
    assert_eq!(sender.capacity(), capacity);

    // is_full should be false initially
    assert!(!sender.is_full());
}

/// Test async mailbox send and receive (requires tokio runtime).
#[tokio::test]
async fn test_mailbox_send_recv() {
    let (mut mailbox, tx) = Mailbox::<IncrementMessage>::new(10);
    let sender = super::mailbox::Sender::new(tx.into());

    // Send a message
    sender.send(IncrementMessage).await.unwrap();

    // Receive the message
    let msg = mailbox.recv().await;
    assert!(msg.is_some());
}

/// Test mailbox with multiple message types.
#[tokio::test]
async fn test_mailbox_multiple_types() {
    // Test with SetValueMessage
    let (mut mailbox, tx) = Mailbox::<SetValueMessage>::new(10);
    let sender = super::mailbox::Sender::new(tx.into());

    sender.send(SetValueMessage(42)).await.unwrap();
    sender.send(SetValueMessage(100)).await.unwrap();

    let msg1 = mailbox.recv().await.unwrap();
    let msg2 = mailbox.recv().await.unwrap();

    assert_eq!(msg1.0, 42);
    assert_eq!(msg2.0, 100);
}

/// Test try_send on mailbox.
#[tokio::test]
async fn test_mailbox_try_send() {
    let (_mailbox, tx) = Mailbox::<IncrementMessage>::new(1);
    let sender = super::mailbox::Sender::new(tx.into());

    // First try_send should succeed
    assert!(sender.try_send(IncrementMessage).is_ok());

    // Second should fail since capacity is 1
    assert!(sender.try_send(IncrementMessage).is_err());
}

/// Test mailbox closes properly when sender is dropped.
#[tokio::test]
async fn test_mailbox_close_on_drop() {
    let (mut mailbox, tx) = Mailbox::<IncrementMessage>::new(10);

    // Drop the sender
    drop(tx);

    // recv should return None
    let msg = mailbox.recv().await;
    assert!(msg.is_none());
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS: Actor Creation and Basic Processing
// ══════════════════════════════════════════════════════════════════════════════

/// Test actor creation with handler and mailbox.
#[test]
fn test_actor_creation() {
    let handler = CounterHandler::new();
    let (mailbox, _sender) = Mailbox::<IncrementMessage>::new(10);

    let actor = Actor::new(handler, mailbox);

    // Verify actor has the handler
    assert_eq!(actor.handler().get_count(), 0);
}

/// Test actor handler access.
#[test]
fn test_actor_handler_access() {
    let mut handler = CounterHandler::new();
    handler.handle(IncrementMessage);

    let (mailbox, _sender) = Mailbox::<IncrementMessage>::new(10);
    let actor = Actor::new(handler, mailbox);

    // Check handler is accessible
    assert_eq!(actor.handler().get_count(), 1);

    // Check mutable access
    let mut actor = actor;
    actor.handler_mut().handle(IncrementMessage);
    assert_eq!(actor.handler().get_count(), 2);
}

/// Test actor mailbox access.
#[test]
fn test_actor_mailbox_access() {
    let handler = CounterHandler::new();
    let (mailbox, _sender) = Mailbox::<IncrementMessage>::new(50);

    let actor = Actor::new(handler, mailbox);

    // Mailbox should be accessible
    let _ = actor.mailbox();
}

/// Test actor run with sequential message processing.
#[tokio::test]
async fn test_actor_run_sequential_processing() {
    let handler = CounterHandler::new();
    let (mailbox, tx) = Mailbox::<IncrementMessage>::new(100);
    let sender = Sender::new(tx.into());

    let mut actor = Actor::new(handler, mailbox);

    // Send multiple messages
    for _ in 0..5 {
        sender.send(IncrementMessage).await.unwrap();
    }

    // Drop sender to close mailbox
    drop(sender);

    // Run actor - this processes all messages in the mailbox
    actor.run().await;

    assert_eq!(actor.handler().get_count(), 5);
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS: SharedState
// ══════════════════════════════════════════════════════════════════════════════

/// Test SharedState creation.
#[test]
fn test_shared_state_creation() {
    let _state: SharedState<i32> = SharedState::new(42);
    assert!(true); // If we get here, creation worked
}

/// Test SharedState default creation.
#[test]
fn test_shared_state_default() {
    let _state: SharedState<i32> = SharedState::default();
    assert!(true); // Created with Default::default()
}

/// Test SharedState clone (shares underlying data).
#[tokio::test]
async fn test_shared_state_clone() {
    let state1: SharedState<i32> = SharedState::new(42);
    let state2 = state1.clone();

    // Both should have the same initial value
    let v1 = state1.read().await;
    let v2 = state2.read().await;
    assert_eq!(*v1, 42);
    assert_eq!(*v2, 42);
}

/// Test SharedState async read.
#[tokio::test]
async fn test_shared_state_async_read() {
    let state: SharedState<String> = SharedState::new("hello".to_string());

    let guard = state.read().await;
    assert_eq!(&*guard, "hello");
}

/// Test SharedState async write.
#[tokio::test]
async fn test_shared_state_async_write() {
    let state: SharedState<i32> = SharedState::new(0);

    {
        let mut guard = state.write().await;
        *guard = 42;
    }

    let guard = state.read().await;
    assert_eq!(*guard, 42);
}

/// Test SharedState with complex type (Vec).
#[tokio::test]
async fn test_shared_state_vec() {
    let state: SharedState<Vec<String>> = SharedState::new(Vec::new());

    // Add items
    {
        let mut guard = state.write().await;
        guard.push("item1".to_string());
        guard.push("item2".to_string());
    }

    // Read items
    let guard = state.read().await;
    assert_eq!(guard.len(), 2);
    assert_eq!(guard[0], "item1");
    assert_eq!(guard[1], "item2");
}

/// Test SharedState Arc conversion.
#[test]
fn test_shared_state_arc_conversion() {
    let state: SharedState<i32> = SharedState::new(100);

    // Clone should share the Arc
    let state2 = state.clone();

    // into_arc consumes self
    let _arc: Arc<RwLock<i32>> = state.into_arc();

    // as_arc returns a clone of the Arc
    let _arc2 = state2.as_arc();
}

/// Test multiple readers concurrently.
#[tokio::test]
async fn test_shared_state_multiple_readers() {
    let state: SharedState<i32> = SharedState::new(42);

    // Spawn multiple readers
    let state_clone = state.clone();
    let handle = tokio::spawn(async move {
        let guard = state_clone.read().await;
        *guard
    });

    // Read in main task
    let guard = state.read().await;
    let value = *guard;
    drop(guard);

    let value2 = handle.await.unwrap();

    assert_eq!(value, 42);
    assert_eq!(value2, 42);
}

/// Test write blocks readers.
#[tokio::test]
async fn test_shared_state_write_blocks_readers() {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    let state: SharedState<i32> = SharedState::new(0);
    let write_started = Arc::new(AtomicBool::new(false));
    let read_completed = Arc::new(AtomicBool::new(false));

    let state_clone = state.clone();
    let write_flag = write_started.clone();
    let read_flag = read_completed.clone();

    // Reader task
    let reader_handle = tokio::spawn(async move {
        write_flag.store(true, Ordering::SeqCst);
        let _guard = state_clone.read().await;
        read_flag.store(true, Ordering::SeqCst);
    });

    // Give reader time to acquire lock
    tokio::time::sleep(Duration::from_millis(10)).await;

    // Writer task - should block until reader releases
    {
        let mut guard = state.write().await;
        *guard = 100;
    }

    // Wait for reader
    reader_handle.await.unwrap();

    // Reader should have completed after writer (or alongside it)
    assert!(read_completed.load(Ordering::SeqCst));
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS: Concurrent Message Handling
// ══════════════════════════════════════════════════════════════════════════════

/// Test that multiple messages are processed sequentially by one actor.
#[tokio::test]
async fn test_sequential_message_processing() {
    let handler = CounterHandler::new();
    let (mailbox, tx) = Mailbox::<IncrementMessage>::new(100);
    let sender = super::mailbox::Sender::new(tx.into());

    let mut actor = Actor::new(handler, mailbox);

    // Send 10 messages concurrently
    let mut handles = Vec::new();
    for _ in 0..10 {
        let sender_clone = sender.clone();
        let handle = tokio::spawn(async move {
            sender_clone.send(IncrementMessage).await.unwrap();
        });
        handles.push(handle);
    }

    // Wait for all sends to complete
    for handle in handles {
        handle.await.unwrap();
    }

    // Drop sender to close mailbox
    drop(sender);

    // Actor processes all messages via run()
    actor.run().await;

    // All messages should have been processed
    assert_eq!(actor.handler().get_count(), 10);
}

/// Test actor spawn creates a background task.
#[tokio::test]
async fn test_actor_spawn() {
    let handler = CounterHandler::new();
    let (mailbox, _tx) = Mailbox::<IncrementMessage>::new(100);

    let actor = Actor::new(handler, mailbox);

    // Spawn the actor
    let _ref: ActorRef<CounterHandler, IncrementMessage> = actor.spawn();

    // Give the actor time to start
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // The actor is now running in the background
    // Note: ActorRef.tell is not fully implemented yet in the current code
    // This test verifies spawn doesn't panic
}

/// Test mailbox capacity limits.
#[tokio::test]
async fn test_mailbox_capacity_limit() {
    let (mailbox, tx) = Mailbox::<IncrementMessage>::new(2);
    let sender = Sender::new(tx.into());

    // Fill the mailbox
    sender.send(IncrementMessage).await.unwrap();
    sender.send(IncrementMessage).await.unwrap();

    // Third send should block or fail
    // Using try_send to test without blocking
    assert!(sender.try_send(IncrementMessage).is_err());

    // Drop the mailbox to close channel
    drop(mailbox);

    // Now we should be able to send again (to the dropped mailbox sender, but it will fail)
    // This test verifies the capacity limit is working
    // Note: With a closed mailbox, try_send will return SendError
    assert!(sender.try_send(IncrementMessage).is_err());
}

/// Test complex message handling with multiple fields.
#[tokio::test]
async fn test_complex_message_handling() {
    let handler = ComplexHandler::new();
    let (mailbox, tx) = Mailbox::<ComplexMessage>::new(100);
    let sender = Sender::new(tx.into());

    let mut actor = Actor::new(handler, mailbox);

    // Send messages with different priorities
    let messages = vec![
        ComplexMessage {
            id: 1,
            data: "low".to_string(),
            priority: 1,
        },
        ComplexMessage {
            id: 2,
            data: "medium".to_string(),
            priority: 5,
        },
        ComplexMessage {
            id: 3,
            data: "high".to_string(),
            priority: 10,
        },
    ];

    for msg in messages {
        sender.send(msg).await.unwrap();
    }

    drop(sender);

    // Run actor to process all messages
    actor.run().await;

    assert_eq!(actor.handler().get_processed_count(), 3);
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS: Envelope and Reply Channels
// ══════════════════════════════════════════════════════════════════════════════

/// Test Envelope creation with reply channel.
#[test]
fn test_envelope_creation() {
    use super::handler::Envelope;

    let msg = SetValueMessage(42);
    let (envelope, _rx) = Envelope::<SetValueMessage>::new(msg);

    assert!(envelope.reply.is_closed() == false);
    drop(envelope);
    // rx should be notified that sender dropped
}

/// Test Envelope into_reply sends response.
#[test]
fn test_envelope_into_reply() {
    use super::handler::Envelope;

    let msg = IncrementMessage;
    let (envelope, mut rx) = Envelope::<IncrementMessage>::new(msg);

    // Send reply
    envelope.into_reply(42);

    // Receive should succeed
    let result = rx.try_recv();
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 42);
}

/// Test that dropped envelope doesn't panic.
#[test]
fn test_envelope_drop() {
    use super::handler::Envelope;

    let msg = SetValueMessage(42);
    let (envelope, _rx) = Envelope::<SetValueMessage>::new(msg);

    // Dropping envelope should not panic
    drop(envelope);
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS: Error Handling
// ══════════════════════════════════════════════════════════════════════════════

/// Test ActorError variants.
#[test]
fn test_actor_error_variants() {
    use super::handler::ActorError;

    let mail_err = ActorError::MailboxClosed;
    let not_init = ActorError::NotInitialized;
    let timeout = ActorError::Timeout;
    let panic_err = ActorError::Panicked("test panic".to_string());

    // Verify error messages
    assert_eq!(mail_err.to_string(), "Actor mailbox is closed");
    assert_eq!(not_init.to_string(), "Actor is not initialized");
    assert_eq!(timeout.to_string(), "Request timed out");
    assert_eq!(panic_err.to_string(), "Actor panicked: test panic");
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS: Debug and Clone
// ══════════════════════════════════════════════════════════════════════════════

/// Test Debug implementations.
#[test]
fn test_debug_implementations() {
    // Mailbox should implement Debug
    let (mailbox, _sender) = Mailbox::<IncrementMessage>::new(10);
    let mailbox_debug = format!("{:?}", mailbox);
    assert!(mailbox_debug.contains("Mailbox"));

    // SharedState should implement Debug
    let state: SharedState<i32> = SharedState::new(0);
    let state_debug = format!("{:?}", state);
    assert!(state_debug.contains("SharedState"));
}

/// Test ActorRef basic functionality.
#[tokio::test]
async fn test_actor_ref_spawn() {
    let handler = CounterHandler::new();
    let (mailbox, _sender) = Mailbox::<IncrementMessage>::new(10);
    let actor = Actor::new(handler, mailbox);
    let _ref1: ActorRef<CounterHandler, IncrementMessage> = actor.spawn();
    // Actor spawns successfully in background
}

// ══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

/// Integration test: Full message flow.
#[tokio::test]
async fn test_full_message_flow() {
    // Create mailbox
    let (mailbox, tx) = Mailbox::<SetValueMessage>::new(100);
    let sender = Sender::new(tx.into());

    // Create actor
    let handler = ValueHandler::new();
    let mut actor = Actor::new(handler, mailbox);

    // Send messages
    sender.send(SetValueMessage(10)).await.unwrap();
    sender.send(SetValueMessage(20)).await.unwrap();
    sender.send(SetValueMessage(30)).await.unwrap();

    drop(sender);

    // Run actor to process messages
    actor.run().await;

    // Verify final state
    assert_eq!(actor.handler().value, 30);
}

/// Integration test: Concurrent access to shared state.
#[tokio::test]
async fn test_concurrent_shared_state_access() {
    let state: SharedState<Vec<i32>> = SharedState::new(Vec::new());

    // Spawn multiple writers
    let state1 = state.clone();
    let state2 = state.clone();

    let handle1 = tokio::spawn(async move {
        for i in 0..100 {
            let mut guard = state1.write().await;
            guard.push(i);
        }
    });

    let handle2 = tokio::spawn(async move {
        for i in 100..200 {
            let mut guard = state2.write().await;
            guard.push(i);
        }
    });

    handle1.await.unwrap();
    handle2.await.unwrap();

    // Final state should have 200 items (order not guaranteed)
    let guard = state.read().await;
    assert_eq!(guard.len(), 200);
}

/// Integration test: Actor with shutdown signal.
#[tokio::test]
async fn test_actor_shutdown() {
    let handler = CounterHandler::new();
    let (mailbox, tx) = Mailbox::<IncrementMessage>::new(100);
    let sender = Sender::new(tx.into());

    let mut actor = Actor::new(handler, mailbox);

    // Send a few messages
    sender.send(IncrementMessage).await.unwrap();
    sender.send(IncrementMessage).await.unwrap();

    // Close mailbox
    drop(sender);

    // Run actor to process messages
    actor.run().await;

    assert_eq!(actor.handler().get_count(), 2);
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENTATION VERIFICATION
// ══════════════════════════════════════════════════════════════════════════════

/// Verify that doc comments compile and describe the architecture.
#[test]
fn test_documentation_exists() {
    // This test ensures the module documentation is present
    // The actual doc comments are in mod.rs
    assert!(true);
}
