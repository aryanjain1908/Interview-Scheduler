"""interviewer badges

Revision ID: f05d57a37719
Revises: fb9774122a19
Create Date: 2026-11-12 12:07:15.809597
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f05d57a37719'
down_revision: Union[str, None] = 'fb9774122a19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('interviewer_badges',
    sa.Column('interviewer_id', sa.Uuid(), nullable=False),
    sa.Column('badge_id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['badge_id'], ['badges.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['interviewer_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('interviewer_id', 'badge_id')
    )


def downgrade() -> None:
    op.drop_table('interviewer_badges')
