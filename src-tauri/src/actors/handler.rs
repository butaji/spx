//! Actor trait and message handling infrastructure.

use std::fmt::Debug;
use tokio::sync::oneshot;

use super::Mailbox;

/// A message that can be handled by an actor.
pub trait Message: Send + 'static {
    /// The type of response returned by handling this message.
    type Response: Send + 'static;
}

/// Trait for types that can handle a specific message type.
///
/// The handler receives a message with an attached reply channel.
/// It should process the message and send the response through the channel.
pub trait Handler<M: Message>: Send + 'static {
    /// Handle a message. The message contains a reply channel that should
    /// be used to send the response. This function should return `()`.
    fn handle(&mut self, msg: M);
}

/// An actor that processes messages from its mailbox.
#[derive(Debug)]
pub struct Actor<A, M>
where
    A: Handler<M> + Send + 'static,
    M: Message,
{
    handler: A,
    mailbox: Mailbox<M>,
}

impl<A, M> Actor<A, M>
where
    A: Handler<M> + Send + 'static,
    M: Message,
{
    /// Create a new actor with the given handler.
    pub fn new(handler: A, mailbox: Mailbox<M>) -> Self {
        Self { handler, mailbox }
    }

    /// Get a reference to the actor's handler.
    pub fn handler(&self) -> &A {
        &self.handler
    }

    /// Get a mutable reference to the actor's handler.
    pub fn handler_mut(&mut self) -> &mut A {
        &mut self.handler
    }

    /// Get the actor's mailbox.
    pub fn mailbox(&self) -> &Mailbox<M> {
        &self.mailbox
    }

    /// Start the actor's message processing loop.
    /// This function runs until the mailbox is closed or the actor is stopped.
    pub async fn run(&mut self) {
        tracing::debug!("Actor started");
        while let Some(msg) = self.mailbox.recv().await {
            self.handler.handle(msg);
        }
        tracing::debug!("Actor stopped");
    }

    /// Start the actor in a background task.
    pub fn spawn(mut self) -> ActorRef<A, M>
    where
        A: 'static,
        M: 'static,
    {
        let (tx, _rx) = oneshot::channel();
        tokio::spawn(async move {
            tx.send(()).ok();
            self.run().await;
        });
        ActorRef {
            _phantom: std::marker::PhantomData,
        }
    }
}

impl<A, M> Actor<A, M>
where
    A: Handler<M> + Send + 'static,
    M: Message + Debug,
{
    /// Run the actor with graceful shutdown handling.
    pub async fn run_with_shutdown(mut self, mut shutdown: tokio::sync::watch::Receiver<bool>) {
        loop {
            tokio::select! {
                msg = self.mailbox.recv() => {
                    match msg {
                        Some(msg) => {
                            tracing::trace!("Actor received: {:?}", msg);
                            self.handler.handle(msg);
                        }
                        None => {
                            tracing::debug!("Mailbox closed, actor shutting down");
                            break;
                        }
                    }
                }
                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        tracing::debug!("Shutdown signal received, stopping actor");
                        break;
                    }
                }
            }
        }
    }
}

/// Reference to a running actor for sending messages.
#[derive(Debug, Clone)]
pub struct ActorRef<A, M> {
    _phantom: std::marker::PhantomData<(A, M)>,
}

impl<A, M> ActorRef<A, M>
where
    A: Handler<M> + Send + 'static,
    M: Message,
{
    /// Send a message and wait for the response.
    pub async fn tell<R>(&self, _msg: M) -> Result<R, ActorError>
    where
        M: std::fmt::Debug,
        R: Send + 'static,
    {
        // This is a simplified version - in practice you'd use a shared sender
        Err(ActorError::NotInitialized)
    }
}

/// Errors that can occur when interacting with actors.
#[derive(Debug, thiserror::Error)]
pub enum ActorError {
    #[error("Actor mailbox is closed")]
    MailboxClosed,

    #[error("Actor is not initialized")]
    NotInitialized,

    #[error("Request timed out")]
    Timeout,

    #[error("Actor panicked: {0}")]
    Panicked(String),
}

/// Extension trait for adding reply channels to messages.
#[allow(dead_code)]
pub trait WithReply<R> {
    fn into_reply(self) -> (Self, oneshot::Receiver<R>)
    where
        Self: Sized,
    {
        let (tx, rx) = oneshot::channel();
        (self.with_reply(tx), rx)
    }

    fn with_reply(self, reply: oneshot::Sender<R>) -> Self;
}

impl<M, R> WithReply<R> for M
where
    M: Message<Response = R>,
{
    fn with_reply(self, _reply: oneshot::Sender<R>) -> Self {
        self
    }
}

/// Helper to create a message with an attached reply channel.
#[macro_export]
macro_rules! with_reply {
    ($msg:expr, $reply_type:ty) => {{
        let (tx, rx) = tokio::sync::oneshot::channel::<$reply_type>();
        let msg = $msg;
        (msg, tx, rx)
    }};
}

/// A message envelope that includes a reply channel.
#[allow(dead_code)]
pub struct Envelope<M: Message> {
    pub msg: M,
    pub reply: oneshot::Sender<M::Response>,
}

#[allow(dead_code)]
impl<M: Message> Envelope<M> {
    pub fn new(msg: M) -> (Self, oneshot::Receiver<M::Response>) {
        let (tx, rx) = oneshot::channel();
        (Self { msg, reply: tx }, rx)
    }

    pub fn into_reply(self, response: M::Response) {
        self.reply.send(response).ok();
    }

    pub fn into_reply_err(self, error: tokio::sync::oneshot::error::RecvError) {
        tracing::warn!("Reply channel closed: {}", error);
    }
}
