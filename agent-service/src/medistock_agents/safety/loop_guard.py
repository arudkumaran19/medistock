from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class LoopGuard:
    """Safeguard against infinite agent execution loops.
    
    Monitors execution cycles, limits recursion depth, and terminates cycles
    safely when iteration thresholds are breached.
    """

    def __init__(self, max_iterations: int = 6):
        self.max_iterations = max_iterations
        self.current_iteration = 0

    def step(self, step_name: str = "") -> bool:
        """Increments step counter and returns True if within safe limit, False otherwise."""
        self.current_iteration += 1
        if self.current_iteration > self.max_iterations:
            logger.warning(
                "LoopGuard: Exceeded maximum permitted iterations (%d) at '%s'. Halting loop.",
                self.max_iterations,
                step_name,
            )
            return False
        return True

    def reset(self) -> None:
        self.current_iteration = 0
