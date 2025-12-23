import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MunicipioSearch from '../MunicipioSearch'

describe('MunicipioSearch', () => {
  const mockOnChange = vi.fn()
  const mockMunicipios = [
    { id: 'rec1', mundep: 'Bogotá D.C.' },
    { id: 'rec2', mundep: 'Medellín' },
    { id: 'rec3', mundep: 'Cali' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should render input when no value selected', () => {
      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      expect(input).toBeInTheDocument()
    })

    it('should render selected value', () => {
      const selectedValue = { id: 'rec1', mundep: 'Bogotá D.C.' }
      render(<MunicipioSearch value={selectedValue} onChange={mockOnChange} />)

      expect(screen.getByText('Bogotá D.C.')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('Escribe para buscar...')).not.toBeInTheDocument()
    })

    it('should render with custom placeholder', () => {
      render(
        <MunicipioSearch
          value={null}
          onChange={mockOnChange}
          placeholder="Buscar municipio..."
        />
      )

      expect(screen.getByPlaceholderText('Buscar municipio...')).toBeInTheDocument()
    })

    it('should disable input when disabled prop is true', () => {
      render(<MunicipioSearch value={null} onChange={mockOnChange} disabled />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      expect(input).toBeDisabled()
    })
  })

  describe('Search functionality', () => {
    it('should show helper text when typing less than 2 characters', async () => {
      const user = userEvent.setup()
      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'B')

      expect(screen.getByText('Escribe al menos 2 caracteres para buscar')).toBeInTheDocument()
    })

    it('should fetch results when typing 2+ characters', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ municipios: mockMunicipios }),
      })

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'Bo')

      // Wait for debounce (300ms)
      await waitFor(
        () => {
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/municipios?search=Bo')
          )
        },
        { timeout: 500 }
      )
    })

    it('should display search results', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ municipios: mockMunicipios }),
      })

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'Bog')

      await waitFor(() => {
        expect(screen.getByText('Bogotá D.C.')).toBeInTheDocument()
        expect(screen.getByText('Medellín')).toBeInTheDocument()
        expect(screen.getByText('Cali')).toBeInTheDocument()
      })
    })

    it('should show loading spinner while fetching', async () => {
      const user = userEvent.setup()
      let resolvePromise: any
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      ;(global.fetch as any).mockReturnValueOnce(fetchPromise)

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'Bog')

      await waitFor(() => {
        const spinner = screen.getByRole('textbox').parentElement?.querySelector('.animate-spin')
        expect(spinner).toBeInTheDocument()
      })

      // Resolve fetch
      resolvePromise({
        ok: true,
        json: async () => ({ municipios: [] }),
      })
    })

    it('should show "no results" message when no municipalities found', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ municipios: [] }),
      })

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'XYZ')

      await waitFor(() => {
        expect(screen.getByText('No se encontraron municipios')).toBeInTheDocument()
      })
    })

    it('should handle fetch errors gracefully', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'Bo')

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled()
      })

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Selection and interaction', () => {
    it('should call onChange when clicking a result', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ municipios: mockMunicipios }),
      })

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'Bo')

      await waitFor(() => {
        expect(screen.getByText('Bogotá D.C.')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Bogotá D.C.'))

      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'rec1',
        mundep: 'Bogotá D.C.',
      })
    })

    it('should clear search and close dropdown after selection', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ municipios: mockMunicipios }),
      })

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...') as HTMLInputElement
      await user.type(input, 'Bo')

      await waitFor(() => {
        expect(screen.getByText('Bogotá D.C.')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Bogotá D.C.'))

      expect(input.value).toBe('')
      expect(screen.queryByText('Medellín')).not.toBeInTheDocument()
    })

    it('should clear selection when clicking X button', async () => {
      const user = userEvent.setup()
      const selectedValue = { id: 'rec1', mundep: 'Bogotá D.C.' }

      render(<MunicipioSearch value={selectedValue} onChange={mockOnChange} />)

      const clearButton = screen.getByText('✕')
      await user.click(clearButton)

      expect(mockOnChange).toHaveBeenCalledWith(null)
    })

    it('should not show clear button when disabled', () => {
      const selectedValue = { id: 'rec1', mundep: 'Bogotá D.C.' }

      render(<MunicipioSearch value={selectedValue} onChange={mockOnChange} disabled />)

      expect(screen.queryByText('✕')).not.toBeInTheDocument()
    })
  })

  describe('Keyboard navigation', () => {
    it('should navigate results with arrow keys', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ municipios: mockMunicipios }),
      })

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'Bo')

      await waitFor(() => {
        expect(screen.getByText('Bogotá D.C.')).toBeInTheDocument()
      })

      // Press ArrowDown
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      // First item should be highlighted
      const firstItem = screen.getByText('Bogotá D.C.').closest('button')
      expect(firstItem).toHaveClass('bg-blue-100')
    })

    it('should select highlighted item with Enter key', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ municipios: mockMunicipios }),
      })

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'Bo')

      await waitFor(() => {
        expect(screen.getByText('Bogotá D.C.')).toBeInTheDocument()
      })

      // Navigate down and press Enter
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockOnChange).toHaveBeenCalledWith({
        id: 'rec1',
        mundep: 'Bogotá D.C.',
      })
    })

    it('should close dropdown with Escape key', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ municipios: mockMunicipios }),
      })

      render(<MunicipioSearch value={null} onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'Bo')

      await waitFor(() => {
        expect(screen.getByText('Bogotá D.C.')).toBeInTheDocument()
      })

      fireEvent.keyDown(input, { key: 'Escape' })

      expect(screen.queryByText('Bogotá D.C.')).not.toBeInTheDocument()
    })
  })

  describe('Click outside behavior', () => {
    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ municipios: mockMunicipios }),
      })

      const { container } = render(
        <div>
          <MunicipioSearch value={null} onChange={mockOnChange} />
          <button>Outside button</button>
        </div>
      )

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      await user.type(input, 'Bo')

      await waitFor(() => {
        expect(screen.getByText('Bogotá D.C.')).toBeInTheDocument()
      })

      // Click outside
      const outsideButton = screen.getByText('Outside button')
      fireEvent.mouseDown(outsideButton)

      await waitFor(() => {
        expect(screen.queryByText('Bogotá D.C.')).not.toBeInTheDocument()
      })
    })
  })

  describe('Required field validation', () => {
    it('should mark input as required when required=true and no value', () => {
      render(<MunicipioSearch value={null} onChange={mockOnChange} required />)

      const input = screen.getByPlaceholderText('Escribe para buscar...')
      expect(input).toBeRequired()
    })

    it('should not mark input as required when value is selected', () => {
      const selectedValue = { id: 'rec1', mundep: 'Bogotá D.C.' }
      render(<MunicipioSearch value={selectedValue} onChange={mockOnChange} required />)

      // When value is selected, input is not shown, so no required attribute
      expect(screen.queryByPlaceholderText('Escribe para buscar...')).not.toBeInTheDocument()
    })
  })
})
