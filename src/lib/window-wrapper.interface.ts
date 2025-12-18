// Interface for abstracting iframe and popup window implementations
// This allows widget.ts to work with either an iframe or popup window transparently

import { MessageType, UiState, type PostMessage } from './iframe-message.types.js'

export interface IWindowWrapper {
  /**
   * Gets the current src/URL of the window (iframe src or popup location)
   */
  getWindowSrc(): string | null

  /**
   * Provides direct access to the underlying Window object for security checks
   */
  getContentWindow(): Window | null

  /**
   * Opens the window with the given URL and UI state
   * @param url - The URL to load
   * @param uiState - The initial UI state
   * @param onLoad - Callback to execute when the window is loaded
   */
  open(url: string, uiState: UiState, onLoad: (url: string) => Promise<void>): void

  /**
   * Destroys/closes the window and cleans up resources
   */
  destroy(): void

  /**
   * Handles UI state changes from the widget
   * @param state - The new UI state
   */
  handleUIStateChange(state: string): void

  /**
   * Posts a message to the widget window
   * @param message - The message to post
   * @param targetOrigin - The target origin for the message
   */
  postMessage<T, R extends MessageType>(message: PostMessage<T, R>, targetOrigin: string): void
}
