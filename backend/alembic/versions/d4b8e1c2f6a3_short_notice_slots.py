"""short-notice slots

Revision ID: d4b8e1c2f6a3
Revises: c7e2f4a9d815
Create Date: 2026-11-12 22:30:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4b8e1c2f6a3'
down_revision: Union[str, None] = 'c7e2f4a9d815'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('slots', sa.Column('short_notice', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    op.drop_column('slots', 'short_notice')
