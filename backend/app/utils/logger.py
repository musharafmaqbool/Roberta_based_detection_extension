import logging

def get_logger(module_name: str) -> logging.Logger:
    """
    Sets up a structured logger for the specified module.
    Ensures that debug logs are clearly attributed during migration.
    """
    logger = logging.getLogger(module_name)
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)
        
        # Create console handler with formatting
        ch = logging.StreamHandler()
        ch.setLevel(logging.DEBUG)
        
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | [%(name)s] %(message)s', 
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        ch.setFormatter(formatter)
        logger.addHandler(ch)
        
    return logger
