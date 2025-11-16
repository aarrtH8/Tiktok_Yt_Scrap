const sessionStore = new Map<string, any>();

export function createSession(data: any): string {
  const sessionId = Date.now().toString();
  sessionStore.set(sessionId, data);
  
  // Auto-cleanup after 1 hour
  setTimeout(() => {
    sessionStore.delete(sessionId);
  }, 60 * 60 * 1000);
  
  return sessionId;
}

export function getSession(sessionId: string): any {
  return sessionStore.get(sessionId);
}

export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}
