class RetryPolicy:
    def should_retry(self, error: Exception) -> bool:
        return isinstance(error, RuntimeError)
