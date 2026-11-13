"""missed interviews and no-show disputes

Revision ID: a3c1d9e7b210
Revises: 884fcf6c3a83
Create Date: 2026-11-12 20:10:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3c1d9e7b210'
down_revision: Union[str, None] = '884fcf6c3a83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('interviews', sa.Column('no_show_note', sa.String(length=300), nullable=True))
    op.add_column('interviews', sa.Column('disputed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('interviews', sa.Column('dispute_reason', sa.String(length=500), nullable=True))
    op.add_column('interviews', sa.Column('dispute_resolution', sa.String(length=32), nullable=True))
    op.add_column('interviews', sa.Column('dispute_resolved_at', sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE interviews SET status = 'missed' WHERE status = 'lapsed'")


def downgrade() -> None:
    op.execute("UPDATE interviews SET status = 'lapsed' WHERE status = 'missed'")
    op.drop_column('interviews', 'dispute_resolved_at')
    op.drop_column('interviews', 'dispute_resolution')
    op.drop_column('interviews', 'dispute_reason')
    op.drop_column('interviews', 'disputed_at')
    op.drop_column('interviews', 'no_show_note')
