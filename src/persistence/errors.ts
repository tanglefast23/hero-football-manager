export class PersistenceMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceMigrationError';
  }
}

export class UnsupportedDatabaseVersionError extends Error {
  constructor(found: number, supported: number) {
    super(
      `database version ${found} is newer than supported version ${supported}`,
    );
    this.name = 'UnsupportedDatabaseVersionError';
  }
}

export class UnsupportedGameSchemaError extends Error {
  constructor(found: number, supported: number) {
    super(
      `game state schema ${found} is unsupported; this build supports schema ${supported}`,
    );
    this.name = 'UnsupportedGameSchemaError';
  }
}

export class CorruptCareerSaveError extends Error {
  constructor(message: string) {
    super(`career save is corrupt: ${message}`);
    this.name = 'CorruptCareerSaveError';
  }
}

export class InvalidGameStateError extends Error {
  constructor(message: string) {
    super(`game state cannot be saved: ${message}`);
    this.name = 'InvalidGameStateError';
  }
}

export class UnsupportedReplaySchemaError extends Error {
  constructor(found: number, supported: number) {
    super(
      `replay schema ${found} is unsupported; this build supports schema ${supported}`,
    );
    this.name = 'UnsupportedReplaySchemaError';
  }
}

export class CorruptReplayEnvelopeError extends Error {
  constructor(message: string) {
    super(`stored replay is corrupt: ${message}`);
    this.name = 'CorruptReplayEnvelopeError';
  }
}

export class InvalidReplayEnvelopeError extends Error {
  constructor(message: string) {
    super(`replay cannot be saved: ${message}`);
    this.name = 'InvalidReplayEnvelopeError';
  }
}
