import { describe, it, expect, beforeAll } from '@jest/globals';
import { SvnService } from '../tools/svn-service';
import { createSvnConfig, validateSvnInstallation } from '../common/utils';

describe('SVN MCP Integration Tests', () => {
  let svnService: SvnService;
  let svnAvailable: boolean;

  beforeAll(async () => {
    const config = createSvnConfig();
    svnService = new SvnService(config);
    svnAvailable = await validateSvnInstallation(config);
  });

  describe('SVN Installation', () => {
    it('should detect if SVN is available', async () => {
      // Este test no falla si SVN no está disponible, solo reporta el estado
      console.log(`SVN Available: ${svnAvailable}`);
      expect(typeof svnAvailable).toBe('boolean');
    });
  });

  describe('Health Check', () => {
    it('should perform health check without errors', async () => {
      const result = await svnService.healthCheck();
      
      expect(result).toBeDefined();
      expect(result.workingDirectory).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      // El comando puede ser 'health-check' si SVN está disponible o 'svn --version' si no lo está
      expect(['health-check', 'svn --version']).toContain(result.command);
      
      if (result.success && result.data) {
        expect(typeof result.data.svnAvailable).toBe('boolean');
        if (result.data.svnAvailable) {
          expect(result.data.version).toBeDefined();
          expect(typeof result.data.workingCopyValid).toBe('boolean');
          expect(typeof result.data.repositoryAccessible).toBe('boolean');
        }
      }
    });
  });

  describe('Configuration', () => {
    it('should create default SVN configuration', () => {
      const config = createSvnConfig();
      
      expect(config).toBeDefined();
      expect(config.svnPath).toBeDefined();
      expect(config.workingDirectory).toBeDefined();
      expect(config.timeout).toBeGreaterThan(0);
    });

    it('should create SVN configuration with overrides', () => {
      const overrides = {
        svnPath: 'custom-svn',
        workingDirectory: '/custom/path',
        timeout: 5000
      };
      
      const config = createSvnConfig(overrides);
      
      expect(config.svnPath).toBe(overrides.svnPath);
      expect(config.workingDirectory).toBe(overrides.workingDirectory);
      expect(config.timeout).toBe(overrides.timeout);
    });
  });

  describe('SVN Service', () => {
    it('should create SVN service instance', () => {
      expect(svnService).toBeDefined();
      expect(svnService).toBeInstanceOf(SvnService);
    });
  });

  // Solo ejecutar tests que requieren SVN si está disponible
  describe('SVN Commands (requires SVN installation)', () => {
    beforeAll(() => {
      if (!svnAvailable) {
        console.warn('SVN not available, skipping SVN command tests');
      }
    });

    it('should handle SVN info gracefully when not in working copy', async () => {
      if (!svnAvailable) {
        console.log('Skipping SVN info test - SVN not available');
        return;
      }

      try {
        await svnService.getInfo();
        // Si llegamos aquí, estamos en un working copy válido
        expect(true).toBe(true);
      } catch (error: any) {
        // Es esperado que falle si no estamos en un working copy
        expect(error.message).toContain('Failed to get SVN info');
      }
    });

    it('should handle SVN status gracefully when not in working copy', async () => {
      if (!svnAvailable) {
        console.log('Skipping SVN status test - SVN not available');
        return;
      }

      try {
        await svnService.getStatus();
        // Si llegamos aquí, estamos en un working copy válido
        expect(true).toBe(true);
      } catch (error: any) {
        // Es esperado que falle si no estamos en un working copy
        expect(error.message).toContain('Failed to get SVN status');
      }
    });
  });
}); 