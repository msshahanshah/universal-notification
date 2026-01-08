.PHONY: help build up down restart logs ps clean rebuild dev prod migrate shell-api shell-db

# Colors for output
BLUE := \033[0;34m
NC := \033[0m # No Color

help: ## Show this help message
	@echo '$(BLUE)Universal Notification System - Docker Commands$(NC)'
	@echo ''
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build all Docker images
	docker-compose build

up: ## Start all services in development mode
	docker-compose up -d
	@echo "$(BLUE)Services started! Access:$(NC)"
	@echo "  - API: http://localhost:3000"
	@echo "  - RabbitMQ UI: http://localhost:15672 (user/password)"

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## View logs from all services
	docker-compose logs -f

logs-api: ## View logs from notification-api
	docker-compose logs -f notification-api

logs-slack: ## View logs from slack-connector
	docker-compose logs -f slack-connector

logs-email: ## View logs from email-connector
	docker-compose logs -f email-connector

logs-sms: ## View logs from sms-connector
	docker-compose logs -f sms-connector

ps: ## Show running containers
	docker-compose ps

clean: ## Stop and remove all containers, networks, and volumes (WARNING: deletes data!)
	docker-compose down -v
	docker system prune -f

rebuild: ## Rebuild and restart all services
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d

rebuild-api: ## Rebuild and restart notification-api only
	docker-compose up -d --build notification-api

rebuild-slack: ## Rebuild and restart slack-connector only
	docker-compose up -d --build slack-connector

rebuild-email: ## Rebuild and restart email-connector only
	docker-compose up -d --build email-connector

rebuild-sms: ## Rebuild and restart sms-connector only
	docker-compose up -d --build sms-connector

dev: ## Start in development mode with logs
	docker-compose up

prod: ## Start in production mode
	docker-compose -f docker-compose.prod.yml up -d --build
	@echo "$(BLUE)Production services started!$(NC)"

prod-down: ## Stop production services
	docker-compose -f docker-compose.prod.yml down

prod-logs: ## View production logs
	docker-compose -f docker-compose.prod.yml logs -f

migrate: ## Run database migrations
	docker-compose exec notification-api npx sequelize-cli db:migrate

shell-api: ## Open shell in notification-api container
	docker-compose exec notification-api sh

shell-db: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U user -d notifications_db

shell-rabbitmq: ## Open RabbitMQ shell
	docker-compose exec rabbitmq sh

status: ## Show detailed service status
	@echo "$(BLUE)Service Status:$(NC)"
	@docker-compose ps
	@echo ""
	@echo "$(BLUE)Docker Volumes:$(NC)"
	@docker volume ls | grep universal-notification

health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@docker-compose exec postgres pg_isready -U user && echo "✓ PostgreSQL is healthy" || echo "✗ PostgreSQL is not healthy"
	@docker-compose exec rabbitmq rabbitmqctl status > /dev/null 2>&1 && echo "✓ RabbitMQ is healthy" || echo "✗ RabbitMQ is not healthy"

backup-db: ## Backup PostgreSQL database
	@mkdir -p backups
	docker-compose exec postgres pg_dump -U user notifications_db > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(BLUE)Database backed up to backups/$(NC)"

restore-db: ## Restore PostgreSQL database (set BACKUP_FILE=path/to/backup.sql)
	@if [ -z "$(BACKUP_FILE)" ]; then echo "Usage: make restore-db BACKUP_FILE=path/to/backup.sql"; exit 1; fi
	cat $(BACKUP_FILE) | docker-compose exec -T postgres psql -U user -d notifications_db
	@echo "$(BLUE)Database restored from $(BACKUP_FILE)$(NC)"

test-api: ## Test API health endpoint
	@curl -s http://localhost:3000/health || echo "API not responding"

setup: ## Initial setup - copy .env and start services
	@if [ ! -f .env ]; then cp env.sample .env && echo "$(BLUE)Created .env file. Please edit it with your credentials.$(NC)"; fi
	@echo "$(BLUE)Building and starting services...$(NC)"
	$(MAKE) build
	$(MAKE) up
	@echo "$(BLUE)Setup complete! Check service status with 'make ps'$(NC)"
