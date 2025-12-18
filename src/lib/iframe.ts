import { MessageType, UiState, type PostMessage } from './iframe-message.types.js'
import type { IWindowWrapper } from './window-wrapper.interface.js'

const DEFAULT_STATUS_MODE_POSITION = 'bottom_right'

const WINDOW_STATUS_MODE_DIMENSION = { width: 320, height: 90 }

const WINDOW_MODAL_MODE_DIMENSION = { width: 360, height: 600 }

type WidgetPosition = 'center' | 'top_left' | 'top_right' | 'bottom_right' | 'bottom_left'

function getCoordinates(position: WidgetPosition, margin = 20) {
  switch (position) {
    case 'center':
      return {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: `${margin}px`
      }

    case 'top_left':
      return {
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        padding: `${margin}px`
      }

    case 'top_right':
      return {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        padding: `${margin}px`
      }

    case 'bottom_right':
      return {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        padding: `${margin}px`
      }

    case 'bottom_left':
      return {
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        padding: `${margin}px`
      }
  }
}

export class IframeWrapper implements IWindowWrapper {
  private iframeContainer: HTMLDivElement | null = null
  private iframe: HTMLIFrameElement | null = null
  private isWidgetOpen = false
  private isWidgetMinimized = false

  debug = false

  private onCloseRequest

  constructor(
    private readonly config: {
      debug?: boolean
      onCloseRequest: () => void
      statusMode?: { position: WidgetPosition }
      minimizedStyle?: 'show' | 'hide' | (string & NonNullable<unknown>)
    }
  ) {
    this.debug = this.config.debug || false

    this.onCloseRequest = this.config.onCloseRequest

    this.handleClickOutside = this.handleClickOutside.bind(this)

    this.initializeContainer()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('[Parent:IframeWrapper]', ...args)
    }
  }

  public getWindowSrc(): string | null {
    return this.iframe?.src || null
  }

  public getContentWindow(): Window | null {
    return this.iframe?.contentWindow ?? null
  }

  // Backward compatibility alias
  public getIframeSrc(): string | null {
    return this.getWindowSrc()
  }

  private initializeContainer(): void {
    if (this.iframeContainer) {
      this.log('Already initialized')
      return
    }
    // Check if we already have the container on the dom
    const existingContainer = document.getElementById('narval-connect-widget-container')
    if (existingContainer) {
      this.log('Already initialized')
      this.iframeContainer = existingContainer as HTMLDivElement
      return
    }

    this.iframeContainer = document.createElement('div')
    this.iframeContainer.id = 'narval-connect-widget-container'
    this.iframeContainer.style.position = 'fixed'
    this.iframeContainer.style.top = '0'
    this.iframeContainer.style.left = '0'
    this.iframeContainer.style.width = '100%'
    this.iframeContainer.style.height = '100%'
    this.iframeContainer.style.display = 'none'
    this.iframeContainer.style.justifyContent = 'center'
    this.iframeContainer.style.alignItems = 'center'
    this.iframeContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    this.iframeContainer.style.zIndex = '2147483647' // +1 from rainbowkit

    this.iframeContainer.style.display = 'none'
    this.iframeContainer.style.zIndex = '2147483647' // +1 from rainbowkit

    // Force pointer event capture - this prevents other overlays on the App
    // from being "clicked" while I'm open.
    this.iframeContainer.style.pointerEvents = 'auto'
    // Create new stacking context to ensure isolation
    this.iframeContainer.style.isolation = 'isolate'
    this.iframeContainer.style.transform = 'translateZ(0)'

    this.iframeContainer.addEventListener('click', this.handleClickOutside)

    document.body.appendChild(this.iframeContainer)
  }

  public open(url: string, uiState: UiState = UiState.MODAL, onLoad: (url: string) => Promise<void>): void {
    if (!this.iframeContainer) {
      this.log('iFrame Container not initialized, initializing now.')
      this.initializeContainer()
    }
    // Check again, so types are happy that we DO in fact have an iframeContainer.
    if (!this.iframeContainer) {
      this.log('Error: iFrame Container not initialized')
      return
    }

    // Create iframe if it doesn't exist
    if (!this.iframe) {
      const existingIframe = document.getElementById('narval-connect-widget-iframe')
      if (existingIframe) {
        this.iframe = existingIframe as HTMLIFrameElement
        this.applySecurityAttributes(this.iframe)
        this.applyTransitionStyles(this.iframe)
      } else {
        this.iframe = document.createElement('iframe')
        this.iframe.id = 'narval-connect-widget-iframe'
        this.applySecurityAttributes(this.iframe)
        this.applyTransitionStyles(this.iframe)
        this.iframeContainer.appendChild(this.iframe)
      }
    }

    this.iframe.src = url

    this.log('Opened with URL:', url)

    const handleOnLoad = () =>
      onLoad(url).finally(() => {
        this.iframe?.removeEventListener('load', handleOnLoad)
      })

    this.iframe?.addEventListener('load', handleOnLoad)
  }

  private handleClickOutside(e: MouseEvent) {
    if (e.target === this.iframeContainer) {
      this.log('@@@ Click outside detected, sending cancel pending requests message before minimize')

      // Send cancel pending requests message to iframe before minimizing.
      this.onCloseRequest()
    }
  }

  public destroy(): void {
    if (this.iframeContainer) {
      this.iframeContainer.removeEventListener('click', this.handleClickOutside)

      this.iframeContainer.style.display = 'none'
      if (this.iframe) {
        this.iframe.src = 'about:blank'
      }
      // Remove the iframe from the dom
      const existingContainer = document.getElementById('narval-connect-widget-container')
      if (existingContainer) {
        document.body.removeChild(existingContainer)
      }
      this.iframeContainer = null
      this.iframe = null

      this.log('Destroy iFrame')
    }
  }

  public handleUIStateChange(state: string) {
    this.log(`Handling UI state change "${state}"`)

    if (!this.iframeContainer) {
      return
    }

    switch (state) {
      case 'modal':
        this.iframeContainer.style.display = 'flex'
        this.iframeContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
        this.iframeContainer.style.pointerEvents = 'auto'

        this.isWidgetMinimized = false
        this.isWidgetOpen = true

        this.resize(WINDOW_MODAL_MODE_DIMENSION)

        this.position('center')

        // Double requestAnimationFrame to ensure transition plays after display change
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (this.iframeContainer) {
              this.iframeContainer.style.opacity = '1'
            }
            if (this.iframe) {
              this.iframe.style.transform = 'translateY(0)'
              this.iframe.style.opacity = '1'
            }
          })
        })

        this.log('Widget modal mode')
        break
      case 'minimized': {
        if (this.config.minimizedStyle === 'show' && this.iframe) {
          this.iframeContainer.style.display = 'flex'
          this.iframeContainer.style.backgroundColor = 'transparent'
          // Allow clicks to pass through.
          this.iframeContainer.style.pointerEvents = 'none'
          // Allow user to click on the iframe.
          this.iframe.style.pointerEvents = 'auto'

          this.isWidgetMinimized = false
          this.isWidgetOpen = true

          this.resize(WINDOW_STATUS_MODE_DIMENSION)
          this.position(this.config.statusMode?.position || DEFAULT_STATUS_MODE_POSITION)

          // Double requestAnimationFrame to ensure transition plays after display change
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (this.iframeContainer) {
                this.iframeContainer.style.opacity = '1'
              }
              if (this.iframe) {
                this.iframe.style.transform = 'translateY(0)'
                this.iframe.style.opacity = '1'
              }
            })
          })

          this.log('Widget minimized to background')
        } else {
          this.iframeContainer.style.display = 'none'

          this.isWidgetMinimized = true
          this.isWidgetOpen = false

          this.log('Widget minimized to background')
        }
        break
      }
      case 'status':
        if (!this.iframe) return

        this.iframeContainer.style.display = 'flex'
        this.iframeContainer.style.backgroundColor = 'transparent'
        // Allow clicks to pass through.
        this.iframeContainer.style.pointerEvents = 'none'
        // Allow user to click on the iframe.
        this.iframe.style.pointerEvents = 'auto'

        this.isWidgetMinimized = false
        this.isWidgetOpen = true

        this.resize(WINDOW_STATUS_MODE_DIMENSION)
        this.position(this.config.statusMode?.position || DEFAULT_STATUS_MODE_POSITION)

        // Reset transform and opacity to make iframe visible
        this.iframe.style.transform = 'translateY(0)'
        this.iframe.style.opacity = '1'

        this.log('Widget mini mode')
        break
    }
  }

  private position(pos: WidgetPosition): void {
    if (!this.iframeContainer) return

    const layout = getCoordinates(pos)

    this.log(`Repositioning iframe to "${pos}"`)

    this.iframeContainer.style.display = layout.display
    this.iframeContainer.style.justifyContent = layout.justifyContent
    this.iframeContainer.style.alignItems = layout.alignItems
    this.iframeContainer.style.padding = layout.padding ?? ''
  }

  private resize(params: { width: number; height: number }) {
    if (!this.iframe) return

    this.log(`Resizing iframe ${params.width}px x ${params.height}px`)

    this.iframe.style.width = `${params.width}px`
    this.iframe.style.height = `${params.height}px`
  }

  public postMessage<T, R extends MessageType>(message: PostMessage<T, R>, targetOrigin: string): void {
    if (!this.iframe || !this.iframe.contentWindow) {
      this.log('Error: Cannot send message, iframe not available')

      return
    }
    this.iframe.contentWindow.postMessage(message, targetOrigin)
  }

  private applySecurityAttributes(iframe: HTMLIFrameElement): void {
    // Security note: allow-same-origin + allow-scripts triggers a browser warning,
    // but is safe here because the iframe always loads from a different origin
    // (widget.narval.xyz vs customer's domain). The same-origin policy prevents
    // cross-origin DOM access while allowing the iframe to use its own storage.
    iframe.setAttribute('sandbox', 'allow-forms allow-popups allow-same-origin allow-scripts')
    iframe.setAttribute('allow', 'clipboard-write')
    iframe.setAttribute('referrerpolicy', 'no-referrer')
  }

  private applyTransitionStyles(iframe: HTMLIFrameElement): void {
    iframe.style.border = 'none'
    iframe.style.borderRadius = '12px'
    iframe.style.transition = 'transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 150ms ease-out'
    iframe.style.transform = 'translateY(100%)'
    iframe.style.opacity = '0'
  }
}
