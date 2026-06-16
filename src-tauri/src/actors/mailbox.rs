//! Mailbox implementation for actor message handling.

use tokio::sync::mpsc;

/// The mailbox is the receiving end of an actor's message queue.
/// Messages sent to the mailbox are processed sequentially by the actor.
#[derive(Debug)]
pub struct Mailbox<M> {
    rx: mpsc::Receiver<M>,
}

impl<M> Mailbox<M> {
    /// Create a new mailbox with the given channel capacity.
    pub fn new(capacity: usize) -> (Self, mpsc::Sender<M>) {
        let (tx, rx) = mpsc::channel(capacity);
        (Self { rx }, tx)
    }

    /// Create a mailbox with default capacity (100 messages).
    pub fn with_default_capacity() -> (Self, mpsc::Sender<M>) {
        Self::new(100)
    }

    /// Take the receiver, consuming the mailbox.
    pub fn into_inner(self) -> mpsc::Receiver<M> {
        self.rx
    }

    /// Receive the next message, returning None if the channel is closed.
    pub async fn recv(&mut self) -> Option<M> {
        self.rx.recv().await
    }
}

impl<M> Clone for Mailbox<M> {
    fn clone(&self) -> Self {
        panic!("Mailbox cannot be cloned - use the sender instead")
    }
}

/// Handle for sending messages to an actor's mailbox.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct Sender<M> {
    tx: mpsc::Sender<M>,
}

impl<M> Sender<M> {
    pub fn new(tx: mpsc::Sender<M>) -> Self {
        Self { tx }
    }

    /// Send a message, waiting if the mailbox is full.
    #[allow(dead_code)]
    pub async fn send(&self, msg: M) -> Result<(), M> {
        self.tx.send(msg).await.map_err(|e| e.0)
    }

    /// Try to send a message without waiting.
    #[allow(dead_code)]
    pub fn try_send(&self, msg: M) -> Result<(), mpsc::error::TrySendError<M>> {
        self.tx.try_send(msg)
    }

    /// Check if the mailbox is full.
    #[allow(dead_code)]
    pub fn is_full(&self) -> bool {
        self.tx.capacity() == 0
    }

    /// Get the number of available slots in the mailbox.
    #[allow(dead_code)]
    pub fn capacity(&self) -> usize {
        self.tx.capacity()
    }

    /// Get the number of messages in the mailbox (approximate).
    #[allow(dead_code)]
    pub fn max_capacity(&self) -> usize {
        self.tx.max_capacity()
    }
}

impl<M> From<mpsc::Sender<M>> for Sender<M> {
    fn from(tx: mpsc::Sender<M>) -> Self {
        Self::new(tx)
    }
}
