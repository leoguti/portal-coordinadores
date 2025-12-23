import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCoordinatorByEmail, listActividadesForCoordinator, createActividad, listAllActividades } from '../airtable'

// Mock fetch globally
global.fetch = vi.fn()

describe('lib/airtable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    process.env.AIRTABLE_API_KEY = 'test-api-key'
    process.env.AIRTABLE_BASE_ID = 'test-base-id'
  })

  describe('getCoordinatorByEmail', () => {
    it('should return coordinator when found', async () => {
      const mockResponse = {
        records: [
          {
            id: 'rec123',
            createdTime: '2024-01-01T00:00:00.000Z',
            fields: {
              Name: 'Test Coordinator',
              Email: 'test@example.com',
            },
          },
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await getCoordinatorByEmail('test@example.com')

      expect(result).toEqual({
        id: 'rec123',
        name: 'Test Coordinator',
        email: 'test@example.com',
      })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('Coordinadores'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })

    it('should normalize email (lowercase and trim)', async () => {
      const mockResponse = {
        records: [
          {
            id: 'rec123',
            fields: {
              Name: 'Test',
              Email: 'test@example.com',
            },
          },
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await getCoordinatorByEmail('  TEST@EXAMPLE.COM  ')

      const callUrl = (global.fetch as any).mock.calls[0][0]
      expect(callUrl).toContain('test@example.com')
      expect(callUrl).toContain('LOWER')
    })

    it('should return null when coordinator not found', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: [] }),
      })

      const result = await getCoordinatorByEmail('notfound@example.com')
      expect(result).toBeNull()
    })

    it('should return null when API returns error', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      const result = await getCoordinatorByEmail('test@example.com')
      expect(result).toBeNull()
    })

    it('should return null when credentials missing', async () => {
      delete process.env.AIRTABLE_API_KEY

      const result = await getCoordinatorByEmail('test@example.com')
      expect(result).toBeNull()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should handle fetch errors gracefully', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const result = await getCoordinatorByEmail('test@example.com')
      expect(result).toBeNull()
    })
  })

  describe('listActividadesForCoordinator', () => {
    it('should return activities for coordinator', async () => {
      const mockCoordinator = {
        id: 'rec123',
        fields: {
          Actividades: ['act1', 'act2'],
        },
      }

      const mockActivities = {
        records: [
          {
            id: 'act1',
            createdTime: '2024-01-01T00:00:00.000Z',
            fields: {
              'Nombre de la Actividad': 'Activity 1',
              Fecha: '2024-01-01',
            },
          },
          {
            id: 'act2',
            createdTime: '2024-01-02T00:00:00.000Z',
            fields: {
              'Nombre de la Actividad': 'Activity 2',
              Fecha: '2024-01-02',
            },
          },
        ],
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCoordinator,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockActivities,
        })

      const result = await listActividadesForCoordinator('rec123')

      expect(result).toHaveLength(2)
      expect(result[0].fields['Nombre de la Actividad']).toBe('Activity 1')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should return empty array when coordinator has no activities', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'rec123',
          fields: {},
        }),
      })

      const result = await listActividadesForCoordinator('rec123')
      expect(result).toEqual([])
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should return empty array when coordinator not found', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      const result = await listActividadesForCoordinator('invalid')
      expect(result).toEqual([])
    })

    it('should return empty array when credentials missing', async () => {
      delete process.env.AIRTABLE_BASE_ID

      const result = await listActividadesForCoordinator('rec123')
      expect(result).toEqual([])
    })
  })

  describe('createActividad', () => {
    it('should create activity with required fields', async () => {
      const mockResponse = {
        id: 'newact123',
        createdTime: '2024-01-01T00:00:00.000Z',
        fields: {
          'Nombre de la Actividad': 'New Activity',
          Fecha: '2024-01-15',
          Tipo: 'Sensibilización',
        },
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await createActividad({
        coordinatorRecordId: 'rec123',
        name: 'New Activity',
        fecha: '2024-01-15',
        descripcion: 'Test description',
        tipo: 'Sensibilización',
      })

      expect(result.id).toBe('newact123')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('Actividades'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      )
    })

    it('should include optional fields when provided', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test', fields: {} }),
      })

      await createActividad({
        coordinatorRecordId: 'rec123',
        name: 'Test',
        fecha: '2024-01-01',
        descripcion: 'Desc',
        tipo: 'Recolección',
        cultivo: 'Arroz',
        municipioId: 'mun123',
        modalidad: ['Presencial'],
        perfilAsistentes: 'Agricultores',
        cantidadParticipantes: 50,
      })

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.fields.Cultivo).toBe('Arroz')
      expect(callBody.fields.Municipio).toEqual(['mun123'])
      expect(callBody.fields.Modalidad).toEqual(['Presencial'])
      expect(callBody.fields['Perfil de Asistentes']).toBe('Agricultores')
      expect(callBody.fields['Cantidad de Participantes']).toBe(50)
    })

    it('should throw error when credentials missing', async () => {
      delete process.env.AIRTABLE_API_KEY

      await expect(
        createActividad({
          coordinatorRecordId: 'rec123',
          name: 'Test',
          fecha: '2024-01-01',
          descripcion: 'Desc',
          tipo: 'Test',
        })
      ).rejects.toThrow('Airtable credentials not configured')
    })

    it('should throw error when API returns error', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => 'Invalid field',
      })

      await expect(
        createActividad({
          coordinatorRecordId: 'rec123',
          name: 'Test',
          fecha: '2024-01-01',
          descripcion: 'Desc',
          tipo: 'Test',
        })
      ).rejects.toThrow('Failed to create activity: 422')
    })
  })

  describe('listAllActividades', () => {
    it('should fetch all activities with pagination', async () => {
      const page1 = {
        records: [
          { id: 'act1', fields: { Fecha: '2024-01-01' } },
          { id: 'act2', fields: { Fecha: '2024-01-02' } },
        ],
        offset: 'page2token',
      }

      const page2 = {
        records: [{ id: 'act3', fields: { Fecha: '2024-01-03' } }],
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page2,
        })

      const result = await listAllActividades()

      expect(result).toHaveLength(3)
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect((global.fetch as any).mock.calls[1][0]).toContain('offset=page2token')
    })

    it('should return empty array when no activities', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: [] }),
      })

      const result = await listAllActividades()
      expect(result).toEqual([])
    })

    it('should handle API errors gracefully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await listAllActividades()
      expect(result).toEqual([])
    })

    it('should stop pagination on error', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [{ id: 'act1', fields: {} }],
            offset: 'token',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

      const result = await listAllActividades()
      expect(result).toHaveLength(1)
    })
  })
})
