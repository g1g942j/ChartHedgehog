package com.example.backend.repository;

import com.example.backend.entity.Diagram;
import com.example.backend.entity.DiagramBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DiagramBlockRepository extends JpaRepository<DiagramBlock, Long> {
    List<DiagramBlock> findByDiagramOrderByZIndex(Diagram diagram);
}