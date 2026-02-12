/**
 * Memory Management Utilities
 * 
 * Provides memory monitoring, cleanup management, and resource tracking
 * to prevent memory leaks and optimize application performance.
 */

interface CleanupFunction {
  id: string;
  fn: () => void;
  priority: number;
}

class MemoryManager {
  private cleanupFunctions: CleanupFunction[] = [];
  private timeouts: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();
  private abortControllers: Map<string, AbortController> = new Map();
  private isMonitoring = false;
  private monitorInterval: NodeJS.Timeout | null = null;

  /**
   * Register a cleanup function to be called during cleanup
   */
  registerCleanup(id: string, fn: () => void, priority: number = 5) {
    // Remove existing cleanup function with same ID
    this.cleanupFunctions = this.cleanupFunctions.filter(cf => cf.id !== id);
    
    this.cleanupFunctions.push({ id, fn, priority });
    
    // Sort by priority (lower number = higher priority)
    this.cleanupFunctions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Unregister a cleanup function
   */
  unregisterCleanup(id: string) {
    this.cleanupFunctions = this.cleanupFunctions.filter(cf => cf.id !== id);
  }

  /**
   * Track a timeout and provide cleanup
   */
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeout = setTimeout(() => {
      this.timeouts.delete(timeout);
      callback();
    }, delay);
    
    this.timeouts.add(timeout);
    return timeout;
  }

  /**
   * Clear and remove a tracked timeout
   */
  clearTimeout(timeout: NodeJS.Timeout) {
    clearTimeout(timeout);
    this.timeouts.delete(timeout);
  }

  /**
   * Track an interval and provide cleanup
   */
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const interval = setInterval(callback, delay);
    this.intervals.add(interval);
    return interval;
  }

  /**
   * Clear and remove a tracked interval
   */
  clearInterval(interval: NodeJS.Timeout) {
    clearInterval(interval);
    this.intervals.delete(interval);
  }

  /**
   * Create an AbortController with automatic tracking
   */
  createAbortController(id: string): AbortController {
    // Clean up existing controller with same ID
    this.abortRequest(id);
    
    const controller = new AbortController();
    this.abortControllers.set(id, controller);
    
    // Auto-cleanup when aborted
    controller.signal.addEventListener('abort', () => {
      this.abortControllers.delete(id);
    });
    
    return controller;
  }

  /**
   * Abort a tracked request
   */
  abortRequest(id: string) {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
  }

  /**
   * Clear all tracked requests
   */
  abortAllRequests() {
    this.abortControllers.forEach((controller, id) => {
      controller.abort();
    });
    this.abortControllers.clear();
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  } | null {
    if (typeof process === 'undefined' || !process.memoryUsage) {
      return null;
    }

    const usage = process.memoryUsage();
    return {
      used: usage.rss,
      total: usage.heapTotal + usage.external,
      percentage: (usage.heapUsed / usage.heapTotal) * 100,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
    };
  }

  /**
   * Check if memory usage is critical
   */
  isMemoryCritical(threshold: number = 85): boolean {
    const stats = this.getMemoryStats();
    return stats ? stats.percentage > threshold : false;
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs: number = 30000) {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      const stats = this.getMemoryStats();
      if (stats) {
        console.log('[Memory] Usage:', {
          percentage: `${stats.percentage.toFixed(1)}%`,
          heapUsed: `${(stats.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(stats.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        });

        // Auto-trigger cleanup if memory is critical
        if (stats.percentage > 90) {
          console.warn('[Memory] Critical memory usage detected, triggering cleanup...');
          this.performCleanup();
        }
      }
    }, intervalMs);

    console.log('[Memory] Monitoring started');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log('[Memory] Monitoring stopped');
  }

  /**
   * Perform cleanup of all tracked resources
   */
  performCleanup() {
    console.log('[Memory] Performing cleanup...');
    
    // Clear all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    
    // Abort all requests
    this.abortAllRequests();
    
    // Execute registered cleanup functions
    this.cleanupFunctions.forEach(({ id, fn }) => {
      try {
        fn();
      } catch (error) {
        console.error(`[Memory] Cleanup function ${id} failed:`, error);
      }
    });
    
    // Trigger garbage collection if available (Node.js)
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
    
    console.log('[Memory] Cleanup completed');
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    return {
      cleanupFunctions: this.cleanupFunctions.length,
      timeouts: this.timeouts.size,
      intervals: this.intervals.size,
      abortControllers: this.abortControllers.size,
      isMonitoring: this.isMonitoring,
    };
  }
}

// Create singleton instance
const memoryManager = new MemoryManager();

export { memoryManager, MemoryManager };

// Utility hooks for React components
export function useMemoryCleanup() {
  return {
    register: memoryManager.registerCleanup.bind(memoryManager),
    unregister: memoryManager.unregisterCleanup.bind(memoryManager),
    performCleanup: memoryManager.performCleanup.bind(memoryManager),
    getStats: memoryManager.getStats.bind(memoryManager),
  };
}

export function useTimeout() {
  return {
    set: memoryManager.setTimeout.bind(memoryManager),
    clear: memoryManager.clearTimeout.bind(memoryManager),
  };
}

export function useInterval() {
  return {
    set: memoryManager.setInterval.bind(memoryManager),
    clear: memoryManager.clearInterval.bind(memoryManager),
  };
}

export function useAbortController() {
  return {
    create: memoryManager.createAbortController.bind(memoryManager),
    abort: memoryManager.abortRequest.bind(memoryManager),
    abortAll: memoryManager.abortAllRequests.bind(memoryManager),
  };
}
